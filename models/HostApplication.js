const mongoose = require("mongoose");

const hostApplicationSchema = new mongoose.Schema({

  name:String,

  mobile:String,

  age:Number,

  city:String,

  languages:String,

  about:{

    type:String,

    default:""

  },

  /* New | Approved | Rejected */

  status:{

    type:String,

    default:"New"

  },

  appliedAt:{

    type:Date,

    default:Date.now

  }

});

module.exports = mongoose.model(
  "HostApplication",
  hostApplicationSchema
);
