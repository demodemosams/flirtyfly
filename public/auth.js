/* Shared behaviour for the login and register pages. */

/* show / hide password */
document.querySelectorAll(".toggle-password").forEach((button) => {

  button.addEventListener("click", () => {

    const input = button.parentElement.querySelector("input");

    const show = input.type === "password";

    input.type = show ? "text" : "password";

    button.classList.toggle("showing", show);

    button.setAttribute(
      "aria-label",
      show ? "Hide password" : "Show password"
    );

    input.focus();

  });

});

/* message shown inside the form instead of a browser alert */
function showMessage(text, ok) {

  const message = document.getElementById("formMessage");

  message.textContent = text;

  message.classList.toggle("ok", !!ok);

  message.classList.add("show");

}

function clearMessage() {

  document.getElementById("formMessage").classList.remove("show");

}

/* disable the submit button while a request is in flight */
function setBusy(button, busyText) {

  if (busyText) {

    button.dataset.label = button.textContent;

    button.textContent = busyText;

    button.disabled = true;

  } else {

    button.textContent = button.dataset.label || button.textContent;

    button.disabled = false;

  }

}
