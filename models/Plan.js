const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({

  name:String,

  /* RUPEES */

  price:Number,

  durationDays:Number,

  /* LONGEST SINGLE CALL IN MINUTES, 0 = UNLIMITED */

  callMinutes:{

    type:Number,

    default:0

  },

  /* EXTRA LINES SHOWN ON THE PLAN CARD */

  features:{

    type:[String],

    default:[]

  },

  /* RAZORPAY PAYMENT LINK THE BUY BUTTON OPENS */

  paymentLink:{

    type:String,

    default:""

  },

  /* SHOWN AS "BEST VALUE" */

  featured:{

    type:Boolean,

    default:false

  },

  /* HIDDEN PLANS CANNOT BE BOUGHT BUT STAY VALID FOR EXISTING SUBSCRIBERS */

  active:{

    type:Boolean,

    default:true

  },

  order:{

    type:Number,

    default:0

  }

});

module.exports = mongoose.model(
  "Plan",
  planSchema
);
