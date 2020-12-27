// const referrerForm = document.getElementById("referrer");
// referrerForm.value = document.referrer

/* Override form submit to track submissions */
const signupForm = document.getElementsByClassName("formkit-form");
console.log(signupForm)
if(signupForm.addEventListener) {
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        setTimeout(submitForm, 1000);
        var formSubmitted = false;
      
        function submitForm() {
          if (!formSubmitted) {
            formSubmitted = true;
            console.log('got here')
            //registerForm.submit();
          }
        }
      
        plausible('signup', {callback: submitForm});
      })    
}
