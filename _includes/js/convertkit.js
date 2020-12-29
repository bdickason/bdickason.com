// const referrerForm = document.getElementById("referrer");
// referrerForm.value = document.referrer

// Wait for embedded script to be loaded
window.onload = (event) => {

  /* Override form submit to track submissions */
  const signupForm = document.querySelector(".formkit-form");
  console.log(signupForm)
  if(signupForm.addEventListener) {
      signupForm.addEventListener('submit', function(e) {
          e.preventDefault();
          setTimeout(submitForm, 1000);
          var formSubmitted = false;
        
          function submitForm() {
            if (!formSubmitted) {
              formSubmitted = true;
              //registerForm.submit();
            }
          }
          console.log('Signup successful');
          gtag('event', 'signup', {
            'event_category': 'bdickason.com',
            'event_label': 'signup',
            'value': window.location.pathname
          });  // Fire google analytics event
          plausible('signup', {callback: submitForm});  // Fire plausible event
        })    
  }
}
