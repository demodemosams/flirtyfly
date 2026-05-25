const mongoose =
require("mongoose");

const userSchema =
new mongoose.Schema({

  name:String,

  mobile:String,

  password:String,

  termsAccepted:{

    type:Boolean,

    default:false

  },

  bio:{

    type:String,

    default:""

  },

  profileImage:{

    type:String,

    default:""

  },

  freeTrialUsed:{

    type:Boolean,

    default:false

  },

  deviceBlocked:{

    type:Boolean,

    default:false

  },

  /* FREE TIMER */

  remainingFreeSeconds:{

    type:Number,

    default:60

  },

  /* SUBSCRIPTIONS */

  subscription:{

    type:String,

    default:""

  },

  subscriptionActive:{

    type:Boolean,

    default:false

  },

  subscriptionExpiry:{

    type:Date,

    default:null

  },

  createdAt:{

    type:Date,

    default:Date.now

  }

});

module.exports =
mongoose.model(

  "User",

  userSchema

);
