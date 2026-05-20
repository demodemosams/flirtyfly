function goLogin(){

  window.location.href = "login.html";

}

function goRegister(){

  window.location.href = "register.html";

}

function openModal(name,img){

  document.getElementById("modal").style.display = "flex";

  document.getElementById("modal-name").innerText = name;

  document.getElementById("modal-img").src = img;

}

function closeModal(){

  document.getElementById("modal").style.display = "none";

}