// ConvertKit embed (.formkit-form): submit listener below is legacy/stub behavior; extend with care
// if newsletter signups misbehave (see git history before changing).
// const referrerForm = document.getElementById("referrer");
// referrerForm.value = document.referrer

// Wait for embedded script to be loaded
window.addEventListener("load", function (event) {
	const signupForm = document.querySelector(".formkit-form");

	if (signupForm && signupForm.addEventListener) {
		signupForm.addEventListener("submit", function (e) {
			e.preventDefault();
			setTimeout(submitForm, 1000);
			var formSubmitted = false;

			function submitForm() {
				if (!formSubmitted) {
					formSubmitted = true;
					//registerForm.submit();
				}
			}

			submitForm();
		});
	}
});
