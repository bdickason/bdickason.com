const referrerForm = document.getElementById("referrer");
referrerForm.value = document.referrer

const signupForm = document.getElementById("signup");
signupForm.value = document.querySelector("meta[name='page']").getAttribute("content");
