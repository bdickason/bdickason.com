// Wait for embedded script to be loaded
window.onload = (event) => {

  /* Override form submit to track submissions */
  const coachingForm = document.querySelector(".typeform-share");


  if(coachingForm && coachingForm.addEventListener) {
      coachingForm.addEventListener('click', function(e) {
          e.preventDefault();
          setTimeout(submitForm, 1000);
          var formSubmitted = false;

          function submitForm() {
            if (!formSubmitted) {
              formSubmitted = true;
              //registerForm.submit();
            }
          }
          gtag('event', 'coaching', {
            'event_category': 'bdickason.com',
            'event_label': 'coaching',
            'value': window.location.pathname
          });  // Fire google analytics event
          plausible('coaching', {callback: submitForm});  // Fire plausible event

      })    
  }
}
