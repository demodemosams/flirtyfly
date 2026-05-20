const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  name: String,

  mobile: String,

  password: String,

termsAccepted:{

  type:Boolean,

  default:false

},
  
  bio: {

    type:String,

    default:""

  },

  profileImage: {

    type:String,

    default:""

  },

freeTrialUsed:{

  type:Boolean,

  default:false

}

,

deviceBlocked:{

  type:Boolean,

  default:false

}

});

module.exports = mongoose.model(
  "User",
  userSchema
);