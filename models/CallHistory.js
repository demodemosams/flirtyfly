const mongoose = require("mongoose");

const callHistorySchema = new mongoose.Schema({

  userMobile:String,

  hostName:String,

  hostImage:String,

  hostId:String,

  /* RUPEES PER MINUTE THE HOST EARNED ON THIS CALL (THE RATE WHEN IT ENDED) */

  rate:Number,

  /* SECONDS BOTH SIDES WERE CONNECTED */

  duration:{

    type:Number,

    default:0

  },

  callTime:{

    type:Date,

    default:Date.now

  }

});

module.exports = mongoose.model(
  "CallHistory",
  callHistorySchema
);