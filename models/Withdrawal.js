const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({

  hostId:String,

  hostName:String,

  hostMobile:String,

  amount:Number,

  payoutDetails:String,

  /* Pending | Paid | Rejected */

  status:{

    type:String,

    default:"Pending"

  },

  requestedAt:{

    type:Date,

    default:Date.now

  },

  processedAt:{

    type:Date,

    default:null

  }

});

module.exports = mongoose.model(
  "Withdrawal",
  withdrawalSchema
);
