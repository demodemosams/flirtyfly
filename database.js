const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/flirtyfly")

.then(() => {

  console.log("MongoDB Connected");

})

.catch((error) => {

  console.log(error);

});