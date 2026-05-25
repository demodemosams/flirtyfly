const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({

  userMobile:{
    type:String
  },

  hostId:{
    type:String
  },

  hostName:{
    type:String
  },

  amount:{
    type:Number
  },

  plan:{
    type:String
  },

  paymentTime:{

    type:Date,

    default:Date.now

  } ,

  subscription:String,

subscriptionActive:{
  type:Boolean,
  default:false
},

  subscriptionExpiry:Date
  
});

module.exports = mongoose.model(

  "Payment",

  paymentSchema

);
