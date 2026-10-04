const mongoose = require("mongoose");

/* ONE DOCUMENT (key "main") HOLDS THE SITE-WIDE SETTINGS */

const settingSchema = new mongoose.Schema({

  key:{

    type:String,

    default:"main"

  },

  /* RUPEES A HOST EARNS PER MINUTE ON CALL */

  hostRatePerMinute:{

    type:Number,

    default:8

  },

  /* SET ONCE THE STARTING PLANS HAVE BEEN CREATED, SO DELETED PLANS STAY DELETED */

  plansSeeded:{

    type:Boolean,

    default:false

  }

});

module.exports = mongoose.model(
  "Setting",
  settingSchema
);
