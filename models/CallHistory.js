const mongoose = require("mongoose");

const callHistorySchema = new mongoose.Schema({

  userMobile:String,

  hostName:String,

  hostImage:String,

  hostId:String,

  callTime:{

    type:Date,

    default:Date.now

  }

});

module.exports = mongoose.model(
  "CallHistory",
  callHistorySchema
);