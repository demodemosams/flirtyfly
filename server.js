
require("./database");

const express = require("express");

const multer = require("multer");

const path = require("path");

const User = require("./models/User");

const Host = require("./models/Host");

const CallHistory = require(
  "./models/CallHistory"
);

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

    const hosts = await Host.find({

      status:"Online"

    });

    res.json(hosts);

  } catch (error) {

    console.log(error);

    res.send("Error Loading Hosts");

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

/* SERVER */

const connectedHosts = {};

io.on("connection", (socket) => {

  console.log("User Connected");

let currentHostId = null;

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

    (data) => {

      const hostSocketId =

        connectedHosts[
          data.hostId
        ];

      if(hostSocketId){

        io.to(hostSocketId).emit(

          "incoming-call",

          {

            callerName:
              data.callerName

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

  if(currentHostId){

    delete connectedHosts[currentHostId];

    await Host.findByIdAndUpdate(

      currentHostId,

      {
        status:"Offline"
      }

    );

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
