
require("./database");

const express = require("express");

const multer = require("multer");

const path = require("path");

const User = require("./models/User");

const Host = require("./models/Host");

const CallHistory = require(
  "./models/CallHistory"
);

const Payment = require(
  "./models/Payment"
);

const Withdrawal = require(
  "./models/Withdrawal"
);

const Plan = require(
  "./models/Plan"
);

const Setting = require(
  "./models/Setting"
);

const HostApplication = require(
  "./models/HostApplication"
);

/* WHAT A HOST EARNED PER MINUTE BEFORE THE RATE BECAME A SETTING;
   STILL USED FOR CALLS THAT HAVE NO RATE STORED ON THEM */

const DEFAULT_HOST_RATE = 8;

/* SETTINGS AND PLANS ARE KEPT IN MEMORY AND RELOADED WHENEVER THE ADMIN CHANGES THEM */

let settings = {
  hostRatePerMinute:DEFAULT_HOST_RATE
};

let plans = [];

async function loadSettings(){

  let saved = await Setting.findOne({
    key:"main"
  });

  if(!saved){

    saved = await Setting.create({
      key:"main"
    });

  }

  settings = {
    hostRatePerMinute:saved.hostRatePerMinute
  };

}

async function loadPlans(){

  /* FIRST RUN ONLY: CREATE THE THREE PLANS THE SITE ALREADY SOLD */

  const main = await Setting.findOne({
    key:"main"
  });

  if(main && !main.plansSeeded){

    main.plansSeeded = true;

    await main.save();

    if(await Plan.countDocuments() === 0) await Plan.create([

      {
        name:"Basic Weekly",
        price:299,
        durationDays:7,
        callMinutes:120,
        features:["HD video calls"],
        paymentLink:"https://razorpay.com/payment-link/plink_StE5rgGODZD30n",
        order:1
      },

      {
        name:"Unlimited Weekly",
        price:899,
        durationDays:7,
        callMinutes:0,
        features:["Priority support"],
        paymentLink:"https://rzp.io/rzp/NK78hWv",
        featured:true,
        order:2
      },

      {
        name:"Monthly Pro",
        price:2499,
        durationDays:30,
        callMinutes:0,
        features:["Exclusive perks"],
        paymentLink:"https://rzp.io/rzp/aqdL9Gy",
        order:3
      }

    ]);

  }

  plans = await Plan.find().sort({
    order:1,
    price:1
  });

}

function findPlan(name){

  return plans.find(
    (plan) => plan.name === name
  );

}

const mongoose = require("mongoose");

mongoose.connection.once("open", async () => {

  try{

    await loadSettings();

    await loadPlans();

  }catch(error){

    console.log(error);

  }

});

/* EVERY USER GETS THIS MANY FREE SECONDS IN TOTAL, THEN MUST SUBSCRIBE */

const FREE_CALL_SECONDS = 60;

/* HOW LONG A USER MAY TALK: seconds = null MEANS UNLIMITED */

function getCallAccess(user){

  if(!user){

    return {
      premium:false,
      seconds:0
    };

  }

  const expiry = user.subscriptionExpiry;

  const subscribed =

    user.subscriptionActive

    && (
      !expiry
      || new Date(expiry) > new Date()
    );

  if(subscribed){

    const plan = findPlan(user.subscription);

    /* A PLAN THE ADMIN HAS SINCE DELETED STAYS UNLIMITED UNTIL IT EXPIRES */

    return {

      premium:true,

      seconds:

      plan && plan.callMinutes > 0
      ? plan.callMinutes * 60
      : null

    };

  }

  return {

    premium:false,

    seconds:Math.max(

      user.remainingFreeSeconds
      ?? FREE_CALL_SECONDS,

      0

    )

  };

}

function creditsOver(access){

  return (
    access.seconds !== null
    && access.seconds <= 0
  );

}

/* ACCESS OF THE USER WHO PLACED A GIVEN CALL */

async function getCallerAccess(callId){

  let user = null;

  try{

    const record =
      await CallHistory.findById(callId);

    if(record){

      user = await User.findOne({
        mobile:record.userMobile
      });

    }

  }catch(error){

    console.log(error);

  }

  return {

    user,

    access:getCallAccess(user)

  };

}

/* HOST EARNINGS SUMMARY */

async function getHostEarnings(hostId){

  const calls =

    await CallHistory.find({
      hostId
    });

  const withdrawals =

    await Withdrawal.find({
      hostId
    });

  const totalSeconds = calls.reduce(

    (total,call) =>
      total + (call.duration || 0),

    0

  );

  const sumByStatus = (status) =>

    withdrawals

    .filter((w) => w.status === status)

    .reduce(
      (total,w) => total + (w.amount || 0),
      0
    );

  /* EACH CALL PAYS THE RATE IT WAS MADE AT, SO CHANGING THE RATE NEVER REWRITES PAST EARNINGS */

  const earned = Math.floor(

    calls.reduce(

      (total,call) =>

        total

        + (call.duration || 0)
        * (call.rate ?? DEFAULT_HOST_RATE)
        / 60,

      0

    )

  );

  const paid = sumByStatus("Paid");

  const pending = sumByStatus("Pending");

  return {

    rate:settings.hostRatePerMinute,
    totalSeconds,
    earned,
    paid,
    pending,

    available:
    earned - paid - pending

  };

}

 

const app = express();

const http = require("http");

const server = http.createServer(app);

const { Server } = require("socket.io");

const io = new Server(server);

/* MIDDLEWARE */

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(express.static("public"));

app.use("/uploads", express.static("uploads"));

/* IMAGE STORAGE */

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(null, "uploads");

  },

  filename: (req, file, cb) => {

    cb(
      null,
      Date.now() + path.extname(file.originalname)
    );

  }

});

const upload = multer({

  storage,

  limits:{
    fileSize: 5 * 1024 * 1024
  },

  fileFilter:(req,file,cb)=>{

    const allowedTypes =

      /jpg|jpeg|png|webp/;

    const extname = allowedTypes.test(

      path.extname(
        file.originalname
      ).toLowerCase()

    );

    if(extname){

      return cb(null,true);

    }

    cb(
      "Only Images Allowed"
    );

  }

});

/* REGISTER */

app.post("/register", async (req, res) => {

  try {

    const {

  name,
  mobile,
  password,
  termsAccepted

} = req.body;

const existingUser = await User.findOne({
  mobile
});

if(existingUser){

  return res.send(
    "Mobile Number Already Registered"
  );

}

    const newUser = new User({

      name,
      mobile,
      password,

termsAccepted:
  !!termsAccepted

    });

    await newUser.save();

    res.send("Registration Successful");

  } catch (error) {

    console.log(error);

    res.send("Error");

  }

});

/* LOGIN */

app.post("/login", async (req, res) => {

  try{

    const { mobile, password } = req.body;

    const foundUser = await User.findOne({

      mobile,
      password

    });

    if(foundUser){

      res.json({

  success:true,

  termsAccepted:
    foundUser.termsAccepted,

  user:{

    name:foundUser.name,

    mobile:foundUser.mobile

  }

});

    }else{

      res.json({

        success:false

      });

    }

  }catch(error){

    console.log(error);

    res.json({

      success:false

    });

  }

});

/* HOST LOGIN */

app.post("/host-login", async (req, res) => {

  const { mobile, password } = req.body;

  const foundHost = await Host.findOne({

    mobile,
    password

  });

  if(foundHost){

    foundHost.status = "Online";

    await foundHost.save();
    
    res.redirect(

      `/host.html?id=${foundHost._id}&name=${foundHost.name}&image=${foundHost.image}`

    );

  }else{

    res.send("Invalid Host Credentials");

  }

});

/* CREATE HOST */

app.post(
  "/create-host",
  upload.single("image"),
  async (req, res) => {

    try {

      const { name, mobile, password } = req.body;

const existingHost = await Host.findOne({
  mobile
});

if(existingHost){

  return res.send(
    "Host Already Exists"
  );

}

      const newHost = new Host({

        name,
        mobile,
        password,

        image: req.file.filename

      });

      await newHost.save();

      

      res.send("Host Created Successfully");

    } catch (error) {

      console.log(error);

      res.send("Error Creating Host");

    }

  }
);

/* GET HOSTS */

app.get("/get-hosts", async (req, res) => {

  try {

    /* ?all=1 ALSO RETURNS OFFLINE HOSTS (THE USER PAGE SHOWS THEM WITH AN OFFLINE TAG) */

    const hosts = await Host.find(

      req.query.all
      ? {}
      : { status:"Online" }

    )

    /* USERS NEVER NEED A HOST'S LOGIN DETAILS */

    .select("-password -mobile");

    res.json(hosts);

  } catch (error) {

    console.log(error);

    res.send("Error Loading Hosts");

  }

});

/* GET ALL HOSTS (ADMIN) */

app.get("/get-all-hosts", async (req, res) => {

  try {

    const hosts = await Host.find();

    res.json(hosts);

  } catch (error) {

    console.log(error);

    res.json([]);

  }

});

/* UPDATE HOST PASSWORD (ADMIN) */

app.put("/update-host-password/:id", async (req, res) => {

  try {

    const password =
      String(req.body.password || "").trim();

    if(!password){

      return res.json({
        success:false,
        message:"Password cannot be empty"
      });

    }

    const host = await Host.findByIdAndUpdate(

      req.params.id,

      { password }

    );

    if(!host){

      return res.json({
        success:false,
        message:"Host Not Found"
      });

    }

    res.json({
      success:true,
      message:"Password Updated"
    });

  } catch (error) {

    console.log(error);

    res.json({
      success:false,
      message:"Error Updating Password"
    });

  }

});

/* DELETE HOST */

app.delete("/delete-host/:id", async (req, res) => {

  try {

  const deletedHost = await Host.findByIdAndDelete(
  req.params.id
);

if(deletedHost){

  res.send("Host Deleted");

}else{

  res.send("Host Not Found");

}

  } catch (error) {

    console.log(error);

    res.send("Error Deleting Host");

  }

});

/* HOST DASHBOARD DATA */

app.get("/host-dashboard/:id", async (req, res) => {

  try{

    const host = await Host.findById(
      req.params.id
    ).select("-password");

    if(!host){

      return res.json({
        success:false
      });

    }

    const calls =

      await CallHistory.find({
        hostId:req.params.id
      }).sort({
        callTime:-1
      });

    const withdrawals =

      await Withdrawal.find({
        hostId:req.params.id
      }).sort({
        requestedAt:-1
      });

    const earnings =

      await getHostEarnings(
        req.params.id
      );

    res.json({

      success:true,
      host,
      calls,
      withdrawals,
      earnings

    });

  }catch(error){

    console.log(error);

    res.json({
      success:false
    });

  }

});

/* HOST WITHDRAWAL REQUEST */

app.post("/host-withdraw", async (req, res) => {

  try{

    const { hostId } = req.body;

    const amount =
      Math.floor(Number(req.body.amount));

    const payoutDetails =
      String(req.body.payoutDetails || "").trim();

    const host = await Host.findById(hostId);

    if(!host){

      return res.json({
        success:false,
        message:"Host Not Found"
      });

    }

    if(!amount || amount < 1){

      return res.json({
        success:false,
        message:"Enter a valid amount"
      });

    }

    if(!payoutDetails){

      return res.json({
        success:false,
        message:"Enter your UPI ID or bank details"
      });

    }

    const earnings =
      await getHostEarnings(hostId);

    if(amount > earnings.available){

      return res.json({
        success:false,
        message:
        `You can withdraw up to ₹${earnings.available}`
      });

    }

    const withdrawal = new Withdrawal({

      hostId,

      hostName:host.name,

      hostMobile:host.mobile,

      amount,

      payoutDetails

    });

    await withdrawal.save();

    res.json({
      success:true,
      message:"Withdrawal request sent"
    });

  }catch(error){

    console.log(error);

    res.json({
      success:false,
      message:"Error sending request"
    });

  }

});

/* GET SETTINGS */

app.get("/get-settings", (req, res) => {

  res.json(settings);

});

/* UPDATE SETTINGS (ADMIN) */

app.put("/update-settings", async (req, res) => {

  try{

    const rate =
      Number(req.body.hostRatePerMinute);

    if(
      !Number.isFinite(rate)
      || rate <= 0
      || rate > 10000
    ){

      return res.json({
        success:false,
        message:"Enter a rate between 1 and 10000"
      });

    }

    await Setting.findOneAndUpdate(

      { key:"main" },

      { hostRatePerMinute:rate },

      { upsert:true }

    );

    await loadSettings();

    res.json({
      success:true,
      message:"Host rate updated",
      settings
    });

  }catch(error){

    console.log(error);

    res.json({
      success:false,
      message:"Error updating settings"
    });

  }

});

/* GET PLANS: USERS SEE ACTIVE PLANS, THE ADMIN PASSES ?all=1 TO SEE HIDDEN ONES TOO */

app.get("/get-plans", (req, res) => {

  res.json(

    req.query.all
    ? plans
    : plans.filter((plan) => plan.active)

  );

});

/* ADD OR EDIT A PLAN (ADMIN) */

app.post("/save-plan", async (req, res) => {

  try{

    const name =
      String(req.body.name || "").trim();

    const price = Number(req.body.price);

    const durationDays =
      Math.floor(Number(req.body.durationDays));

    const callMinutes =
      Math.max(
        Math.floor(Number(req.body.callMinutes) || 0),
        0
      );

    const paymentLink =
      String(req.body.paymentLink || "").trim();

    if(!name){

      return res.json({
        success:false,
        message:"Enter a plan name"
      });

    }

    if(!Number.isFinite(price) || price <= 0){

      return res.json({
        success:false,
        message:"Enter a price above 0"
      });

    }

    if(!durationDays || durationDays < 1){

      return res.json({
        success:false,
        message:"Enter how many days the plan is valid for"
      });

    }

    if(
      paymentLink
      && !/^https:\/\//i.test(paymentLink)
    ){

      return res.json({
        success:false,
        message:"The payment link must start with https://"
      });

    }

    /* USERS ARE LINKED TO A PLAN BY ITS NAME, SO NAMES MUST BE UNIQUE */

    const sameName = plans.find(

      (plan) =>

        plan.name.toLowerCase() === name.toLowerCase()

        && String(plan._id) !== String(req.body._id || "")

    );

    if(sameName){

      return res.json({
        success:false,
        message:"Another plan already has that name"
      });

    }

    const fields = {

      name,
      price,
      durationDays,
      callMinutes,
      paymentLink,

      features:

        (
          Array.isArray(req.body.features)
          ? req.body.features
          : []
        )

        .map((line) => String(line).trim())

        .filter(Boolean),

      featured:!!req.body.featured,

      active:req.body.active !== false,

      order:Number(req.body.order) || 0

    };

    if(req.body._id){

      const existing =
        await Plan.findById(req.body._id);

      if(!existing){

        return res.json({
          success:false,
          message:"Plan not found"
        });

      }

      /* KEEP EXISTING SUBSCRIBERS ATTACHED WHEN THE PLAN IS RENAMED */

      if(existing.name !== name){

        await User.updateMany(

          { subscription:existing.name },

          { subscription:name }

        );

      }

      await Plan.findByIdAndUpdate(
        req.body._id,
        fields
      );

    }else{

      await Plan.create(fields);

    }

    await loadPlans();

    res.json({
      success:true,
      message:"Plan saved"
    });

  }catch(error){

    console.log(error);

    res.json({
      success:false,
      message:"Error saving plan"
    });

  }

});

/* DELETE A PLAN (ADMIN) */

app.delete("/delete-plan/:id", async (req, res) => {

  try{

    const deleted =
      await Plan.findByIdAndDelete(req.params.id);

    if(!deleted){

      return res.json({
        success:false,
        message:"Plan not found"
      });

    }

    await loadPlans();

    res.json({
      success:true,
      message:"Plan deleted"
    });

  }catch(error){

    console.log(error);

    res.json({
      success:false,
      message:"Error deleting plan"
    });

  }

});

/* HOST APPLICATION (FROM THE LANDING PAGE) */

app.post("/host-apply", async (req, res) => {

  try{

    const clean = (value, max) =>
      String(value || "").trim().slice(0, max);

    const name = clean(req.body.name, 80);

    const mobile =
      clean(req.body.mobile, 20).replace(/[^\d+]/g, "");

    const age = Math.floor(Number(req.body.age));

    const city = clean(req.body.city, 80);

    const languages = clean(req.body.languages, 120);

    const about = clean(req.body.about, 1000);

    if(!name || !city || !languages){

      return res.json({
        success:false,
        message:"Please fill in your name, city and languages"
      });

    }

    if(mobile.replace(/\D/g, "").length < 10){

      return res.json({
        success:false,
        message:"Enter a valid mobile number"
      });

    }

    /* HOSTS MUST BE ADULTS */

    if(!age || age < 18 || age > 99 || !req.body.isAdult){

      return res.json({
        success:false,
        message:"You must be 18 or older to apply"
      });

    }

    /* ONE OPEN APPLICATION PER MOBILE NUMBER */

    const open = await HostApplication.findOne({
      mobile,
      status:"New"
    });

    if(open){

      return res.json({
        success:true,
        message:"We already have your application and will contact you soon"
      });

    }

    await HostApplication.create({

      name,
      mobile,
      age,
      city,
      languages,
      about

    });

    res.json({
      success:true,
      message:"Application received"
    });

  }catch(error){

    console.log(error);

    res.json({
      success:false,
      message:"Something went wrong. Please try again."
    });

  }

});

/* GET HOST APPLICATIONS (ADMIN) */

app.get("/get-host-applications", async (req, res) => {

  try{

    const applications =

      await HostApplication.find()
      .sort({appliedAt:-1});

    res.json(applications);

  }catch(error){

    console.log(error);

    res.json([]);

  }

});

/* UPDATE HOST APPLICATION STATUS (ADMIN) */

app.put("/update-host-application/:id", async (req, res) => {

  try{

    const { status } = req.body;

    if(
      !["New","Approved","Rejected"]
      .includes(status)
    ){

      return res.json({
        success:false,
        message:"Invalid status"
      });

    }

    const application =

      await HostApplication.findByIdAndUpdate(

        req.params.id,

        { status }

      );

    if(!application){

      return res.json({
        success:false,
        message:"Application not found"
      });

    }

    res.json({
      success:true,
      message:`Application marked ${status}`
    });

  }catch(error){

    console.log(error);

    res.json({
      success:false,
      message:"Error updating application"
    });

  }

});

/* DELETE HOST APPLICATION (ADMIN) */

app.delete("/delete-host-application/:id", async (req, res) => {

  try{

    const deleted =

      await HostApplication.findByIdAndDelete(
        req.params.id
      );

    res.json({

      success:!!deleted,

      message:

      deleted
      ? "Application deleted"
      : "Application not found"

    });

  }catch(error){

    console.log(error);

    res.json({
      success:false,
      message:"Error deleting application"
    });

  }

});

/* GET WITHDRAWALS (ADMIN) */

app.get("/get-withdrawals", async (req, res) => {

  try{

    const withdrawals =

      await Withdrawal.find()
      .sort({requestedAt:-1});

    res.json(withdrawals);

  }catch(error){

    console.log(error);

    res.json([]);

  }

});

/* UPDATE WITHDRAWAL STATUS (ADMIN) */

app.put("/update-withdrawal/:id", async (req, res) => {

  try{

    const { status } = req.body;

    if(
      status !== "Paid"
      && status !== "Rejected"
    ){

      return res.json({
        success:false,
        message:"Invalid status"
      });

    }

    /* ONLY A PENDING REQUEST CAN BE DECIDED */

    const withdrawal =

      await Withdrawal.findOneAndUpdate(

        {
          _id:req.params.id,
          status:"Pending"
        },

        {
          status,
          processedAt:new Date()
        }

      );

    if(!withdrawal){

      return res.json({
        success:false,
        message:"Request not found or already processed"
      });

    }

    res.json({
      success:true,
      message:`Request marked ${status}`
    });

  }catch(error){

    console.log(error);

    res.json({
      success:false,
      message:"Error updating request"
    });

  }

});

/* HOST CHANGE PASSWORD */

app.post("/host-change-password", async (req, res) => {

  try{

    const {

      hostId,
      currentPassword

    } = req.body;

    const newPassword =
      String(req.body.newPassword || "").trim();

    if(!newPassword){

      return res.json({
        success:false,
        message:"New password cannot be empty"
      });

    }

    const host = await Host.findById(hostId);

    if(
      !host
      || host.password !== currentPassword
    ){

      return res.json({
        success:false,
        message:"Current password is incorrect"
      });

    }

    host.password = newPassword;

    await host.save();

    res.json({
      success:true,
      message:"Password Updated"
    });

  }catch(error){

    console.log(error);

    res.json({
      success:false,
      message:"Error Updating Password"
    });

  }

});

/* HOST LOGOUT */

app.get("/host-logout/:id", async (req, res) => {

  try{

    const host = await Host.findById(
      req.params.id
    );

    host.status = "Offline";

    await host.save();

    res.redirect("/host-login.html");

  }catch(error){

    console.log(error);

    res.send("Logout Error");

  }

});

/* ADMIN LOGIN */

app.post("/admin-login", (req, res) => {

  const { mobile, password } = req.body;

  if(

    mobile === "9999999999"

    &&

    password === "admin123"

  ){

    res.redirect("/admin.html");

  }else{

    res.send("Invalid Admin Credentials");

  }

});

/* UPDATE PROFILE */

app.post(
  "/update-profile",

  async (req, res) => {

    try{

      const {

        mobile,
        name,
        bio

      } = req.body;

      const user =
        await User.findOne({
          mobile
        });

      if(user){

  if(!name || name.trim() === ""){

    return res.json({
      success:false
    });

  }

  user.name = name.trim();

  user.bio = bio || "";

        await user.save();

        res.json({
          success:true
        });

      }else{

        res.json({
          success:false
        });

      }

    }catch(error){

      console.log(error);

      res.json({
        success:false
      });

    }

  }
);

/* SAVE CALL HISTORY */

app.post(
  "/save-call",

  async (req, res) => {

    try{

     const {

  userMobile,
  hostId,
  hostName,
  hostImage

} = req.body;

      const newCall =
        new CallHistory({

          userMobile,
          hostId,
          hostName,
          hostImage

        });

      await newCall.save();

      res.json({
        success:true,
        callId:newCall._id
      });

    }catch(error){

      console.log(error);

      res.json({
        success:false
      });

    }

  }
);

/* GET CALL HISTORY */

app.get(
  "/call-history/:mobile",

  async (req, res) => {

    try{

      const calls =
        await CallHistory.find({

          userMobile:
          req.params.mobile

        }).sort({
          callTime:-1
        });

      res.json(calls);

    }catch(error){

      console.log(error);

      res.json([]);

    }

  }
);

/* TOGGLE HOST STATUS */

app.post(

  "/toggle-host-status",

  async (req, res) => {

    try{

      const {

        hostId,
        status

      } = req.body;

      const host =
        await Host.findById(
          hostId
        );

      if(host){

        host.status = status;

        await host.save();

        res.json({
          success:true
        });

      }else{

        res.json({
          success:false
        });

      }

    }catch(error){

      console.log(error);

      res.json({
        success:false
      });

    }

  }

);

/* CHECK FREE TRIAL */

app.get(

  "/check-free-trial/:mobile",

  async (req, res) => {

    try{

      const user =
        await User.findOne({
          mobile:req.params.mobile
        });

      if(user){

        res.json({

  success:true,

  freeTrialUsed:
    user.freeTrialUsed,

  deviceBlocked:
    user.deviceBlocked

});

      }else{

        res.json({
          success:false
        });

      }

    }catch(error){

      console.log(error);

      res.json({
        success:false
      });

    }

  }

);

/* COMPLETE FREE TRIAL */

app.post(

  "/complete-free-trial",

  async (req, res) => {

    try{

      const { mobile } = req.body;

      const user =
        await User.findOne({
          mobile
        });

      if(user){

        user.freeTrialUsed = true;

        user.deviceBlocked = true;

        await user.save();

        res.json({
          success:true
        });

      }else{

        res.json({
          success:false
        });

      }

    }catch(error){

      console.log(error);

      res.json({
        success:false
      });

    }

  }

);

/* ACCEPT TERMS */

app.post(

  "/accept-terms",

  async (req,res) => {

    try{

      const { mobile } = req.body;

      const user =
        await User.findOne({
          mobile
        });

      if(user){

        user.termsAccepted = true;

        await user.save();

        res.json({
          success:true
        });

      }else{

        res.json({
          success:false
        });

      }

    }catch(error){

      console.log(error);

      res.json({
        success:false
      });

    }

  }

);

app.get(

  "/login-check/:mobile",

  async (req,res) => {

    const user =
      await User.findOne({

        mobile:req.params.mobile

      });

    if(user){

      res.json({

        termsAccepted:
          user.termsAccepted

      });

    }else{

      res.json({

        termsAccepted:false

      });

    }

  }

);

/* SAVE PAYMENT */

app.post(

  "/save-payment",

  async (req, res) => {

    try{

      const {

        userMobile,
        hostId,
        hostName,
        amount,
        plan

      } = req.body;

      /* SAVE PAYMENT */

      const newPayment =
        new Payment({

          userMobile,
          hostId,
          hostName,
          amount,
          plan

        });

      await newPayment.save();

      /* FIND USER */

      const user =

      await User.findOne({

        mobile:userMobile

      });

      if(user){

        let expiryDate =
        new Date();

        /* THE PLAN'S VALIDITY COMES FROM THE ADMIN SETTINGS */

        const boughtPlan = findPlan(plan);

        if(boughtPlan){

          expiryDate.setDate(

            expiryDate.getDate()
            + boughtPlan.durationDays

          );

        }

        /* ACTIVATE PLAN */

        user.subscription =
        plan;

        user.subscriptionActive =
        true;

        user.subscriptionExpiry =
        expiryDate;

        await user.save();

      }

      res.json({
        success:true
      });

    }catch(error){

      console.log(error);

      res.json({
        success:false
      });

    }

  }

);



/* GET PAYMENTS */

app.get(

  "/get-payments",

  async (req,res) => {

    try{

      const payments =

        await Payment.find()

        .sort({
          paymentTime:-1
        });

      res.json(payments);

    }catch(error){

      console.log(error);

      res.json([]);

    }

  }

);

/* SERVER */

const connectedHosts = {};

/* callId -> { user, host, startedAt } FOR CALLS IN PROGRESS */

const activeCalls = {};

/* END A CALL: SAVE ITS DURATION AND TELL THE OTHER SIDE */

async function finishCall(callId, leavingSocketId){

  const call = activeCalls[callId];

  if(!call){
    return;
  }

  delete activeCalls[callId];

  clearTimeout(call.timer);

  [call.user, call.host].forEach((socketId) => {

    if(
      socketId
      && socketId !== leavingSocketId
    ){

      io.to(socketId).emit("call-ended");

    }

  });

  /* THE CLOCK ONLY RUNS ONCE BOTH SIDES HAVE JOINED */

  if(!call.startedAt){
    return;
  }

  const duration = Math.round(
    (Date.now() - call.startedAt) / 1000
  );

  try{

    await CallHistory.findByIdAndUpdate(

      callId,

      {
        duration,
        rate:settings.hostRatePerMinute
      }

    );

    /* A FREE USER SPENDS THEIR FREE SECONDS */

    if(call.freeUserMobile){

      const user = await User.findOne({
        mobile:call.freeUserMobile
      });

      if(user){

        user.remainingFreeSeconds = Math.max(

          (
            user.remainingFreeSeconds
            ?? FREE_CALL_SECONDS
          ) - duration,

          0

        );

        if(user.remainingFreeSeconds <= 0){

          user.freeTrialUsed = true;

        }

        await user.save();

      }

    }

  }catch(error){

    console.log(error);

  }

}

/* THE USER HAS RUN OUT OF TIME: SHOW THEM THE PAYWALL, END THE CALL */

async function endForCredits(callId){

  const call = activeCalls[callId];

  if(!call){
    return;
  }

  if(call.user){

    io.to(call.user).emit("credits-over");

  }

  await finishCall(
    callId,
    call.user
  );

}

/* BOTH SIDES ARE CONNECTED: START TIMING THE CALL */

async function startCallClock(callId){

  const call = activeCalls[callId];

  const { user, access } =
    await getCallerAccess(callId);

  /* CALL ENDED WHILE WE WERE LOOKING THE USER UP */

  if(activeCalls[callId] !== call){
    return;
  }

  if(creditsOver(access)){

    return endForCredits(callId);

  }

  call.startedAt = Date.now();

  call.freeUserMobile =

    access.premium
    ? null
    : user.mobile;

  io.to(call.user).emit(

    "call-started",

    {
      seconds:access.seconds
    }

  );

  if(access.seconds !== null){

    call.timer = setTimeout(

      () => endForCredits(callId),

      access.seconds * 1000

    );

  }

}

io.on("connection", (socket) => {

  console.log("User Connected");

let currentHostId = null;

let currentCallId = null;

  socket.on(

    "call-joined",

    async (data) => {

      /* A USER WITH NO CALL ID HAS NOT GONE THROUGH THE ACCESS CHECK */

      if(!data || !data.callId){

        if(!data || data.role !== "host"){

          socket.emit("credits-over");

        }

        return;

      }

      const callId = String(data.callId);

      currentCallId = callId;

      const call =

        activeCalls[callId] =

        activeCalls[callId] || {};

      call[
        data.role === "host"
        ? "host"
        : "user"
      ] = socket.id;

      if(
        call.user
        && call.host
        && !call.clockRequested
      ){

        call.clockRequested = true;

        return startCallClock(callId);

      }

      /* USER WAITING FOR THE HOST: STOP THEM NOW IF THEY HAVE NO TIME LEFT */

      if(data.role !== "host"){

        const { access } =
          await getCallerAccess(callId);

        if(
          creditsOver(access)
          && activeCalls[callId] === call
        ){

          await endForCredits(callId);

        }

      }

    }

  );

  socket.on(

    "join-room",

    (roomId) => {

      socket.join(roomId);

    }

  );

  socket.on(

    "register-host",

    (hostId) => {

currentHostId = hostId;

      connectedHosts[
        hostId
      ] = socket.id;

      console.log(
        "Host Registered:",
        hostId
      );

    }

  );

  socket.on(

    "call-host",

    async (data) => {

      /* DO NOT RING THE HOST FOR A USER WHO HAS NO TIME LEFT */

      const { access } =

        await getCallerAccess(
          data && data.callId
        );

      if(creditsOver(access)){

        socket.emit("credits-over");

        return;

      }

      const hostSocketId =

        connectedHosts[
          data.hostId
        ];

      if(hostSocketId){

        io.to(hostSocketId).emit(

          "incoming-call",

          {

            callerName:
              data.callerName,

            callId:
              data.callId

          }

        );

      }

    }

  );

  socket.on(

    "offer",

    (data) => {

      socket.to(
        data.roomId
      ).emit(

        "offer",

        data.offer

      );

    }

  );

  socket.on(

    "answer",

    (data) => {

      socket.to(
        data.roomId
      ).emit(

        "answer",

        data.answer

      );

    }

  );

  socket.on(

    "ice-candidate",

    (data) => {

      socket.to(
        data.roomId
      ).emit(

        "ice-candidate",

        data.candidate

      );

    }

  );

socket.on("disconnect", async () => {

  /* LEAVING THE CALL PAGE ENDS THE CALL */

  if(currentCallId){

    await finishCall(
      currentCallId,
      socket.id
    );

  }

  if(currentHostId){

    delete connectedHosts[currentHostId];

   

    console.log(
      "Host Disconnected"
    );

  }

});

});

app.get(

  "/host-call-history/:hostId",

  async (req,res) => {

    try{

      const calls =

        await CallHistory.find({

          hostId:
          req.params.hostId

        }).sort({
          callTime:-1
        });

      res.json(calls);

    }catch(error){

      console.log(error);

      res.json([]);

    }

  }

);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

  console.log(
    `Server Running On ${PORT}`
  );

});

/* =========================
   GET ALL USERS
========================= */

app.get(
  "/get-users",

  async (req,res)=>{

    try{

      const users =

        await User.find()
        .sort({_id:-1});

      res.json(users);

    }catch(error){

      console.log(error);

      res.json([]);

    }

  }

);

/* =========================
   DELETE USER
========================= */

app.delete(
  "/delete-user/:id",

  async (req,res)=>{

    try{

      await User.findByIdAndDelete(
        req.params.id
      );

      res.send(
        "User Deleted"
      );

    }catch(error){

      console.log(error);

      res.send(
        "Delete Failed"
      );

    }

  }

);

/* =========================
   GET ALL CALLS (ADMIN)
========================= */

app.get(
  "/get-all-calls",

  async (req,res)=>{

    try{

      const calls =

        await CallHistory.find()
        .sort({callTime:-1});

      res.json(calls);

    }catch(error){

      console.log(error);

      res.json([]);

    }

  }

);

/* =========================
   ADMIN STATS
========================= */

app.get(
  "/admin-stats",

  async (req,res)=>{

    try{

      const totalUsers =
        await User.countDocuments();

      const totalHosts =
        await Host.countDocuments();

      const onlineHosts =
        await Host.countDocuments({
          status:"Online"
        });

      const totalPayments =
        await Payment.find();

      let revenue = 0;

      totalPayments.forEach((p)=>{

        revenue += p.amount || 0;

      });

      const today = new Date();

      today.setHours(0,0,0,0);

      const todayUsers =

        await User.countDocuments({

          createdAt:{
            $gte:today
          }

        });

      res.json({

        totalUsers,
        totalHosts,
        onlineHosts,
        revenue,
        todayUsers,
        totalPayments:
        totalPayments.length

      });

    }catch(error){

      console.log(error);

      res.json({

        totalUsers:0,
        totalHosts:0,
        onlineHosts:0,
        revenue:0,
        todayUsers:0,
        totalPayments:0

      });

    }

  }
 
);



 app.get(

  "/check-call-access/:mobile",

  async (req,res)=>{

    try{

      const user =

      await User.findOne({

        mobile:
        req.params.mobile

      });

      /* USER NOT FOUND */

      if(!user){

        return res.json({

          success:false

        });

      }

      const access = getCallAccess(user);

      return res.json({

        success:true,

        premium:access.premium,

        creditsOver:creditsOver(access),

        /* CURRENT PLAN, ONLY WHILE IT IS ACTIVE */

        plan:

        access.premium
        ? user.subscription
        : "",

        expiry:

        access.premium
        ? user.subscriptionExpiry
        : null,

        /* 999999 = UNLIMITED */

        callTime:

        access.seconds === null
        ? 999999
        : access.seconds

      });

    }catch(error){

      console.log(error);

      res.json({

        success:false

      });

    }

  }

);
