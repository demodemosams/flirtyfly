const mongoose = require("mongoose");

const hostSchema = new mongoose.Schema({

  name: String,

  mobile: String,

  password: String,

  image: String,

  status: {

    type: String,

    default: "Offline"

  }

});

module.exports = mongoose.model(
  "Host",
  hostSchema
);