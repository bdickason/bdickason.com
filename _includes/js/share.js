/* Show/hide sharing pop up */
window.addEventListener('load', function(event) {
    // Modal to display sharing options 
    const shareWindow = document.getElementsByClassName('share-background')[0];

    /* Events that open share window */
    // Listen for sharing button click *
    const shareButton = document.getElementById('share');
    shareButton.onclick = function() {
        toggleVisibility(shareWindow);
    }

    // Check if user was sent from email w/ share permalink 
    if(window.location.hash == '#share') {
        // Clear the hash so the page doesn't share on refresh
        window.location.hash = '';  

        // Display sharing popup
        toggleVisibility(shareWindow);
    }

    /* Events that close share window */
    /* Click the 'x' button */
    const closeButton = document.getElementById('close');
    closeButton.onclick = function() {
        toggleVisibility(shareWindow);
    }

    /* Click outside the modal */
    shareWindow.onclick = function(e) {
        if(e.target.className == 'share-background') {
            toggleVisibility(shareWindow);
        }
    }

    /* Handle Copy Link */
    const copyLinkButton = document.getElementById('copylink')

    copyLinkButton.onclick = function(e) {
        copyLink(e.target);
    }

    /* Share Button Tracking */
    const shareButtons = document.getElementsByClassName("resp-sharing-button__link")
    for(let i = 0; i < shareButtons.length; i++) {
        shareButtons[i].onclick = function (e) {
            console.log(e.target.dataset.destination)
             // Fire google analytics event
            gtag('event', 'share', {
                'event_category': 'bdickason.com',
                'event_label': e.target.dataset.destination
              }); 

            // Fire plausible event
            plausible('share', {
                props: {
                    destination: e.target.dataset.destination
                }
            }); 
        };
    }
});

function toggleVisibility(modal) {
    if(modal.style.display == 'none' || modal.style.display == '') {
        modal.style.display = 'block';
    } else {
        modal.style.display = 'none';
    }
}


function copyLink(container) {
    /* Create temporary input (copy only supports text inputs) and copy to clipboard */
    var dummy = document.createElement('input'),
    text = window.location.href;

    document.body.appendChild(dummy);
    dummy.value = text;
    dummy.select();
    document.execCommand('copy');
    document.body.removeChild(dummy);

    container.classList.add('success')

}