const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://demodemosams_db_user:RJcc1o6jRFXH6W82@cluster0.amaamuw.mongodb.net/flirtyfly?retryWrites=true&w=majority"
)

.then(() => {

  console.log("MongoDB Connected");

})

.catch((error) => {

  console.log("MongoDB Error:", error);

});
