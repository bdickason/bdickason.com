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

    // Click close = close window
});

function toggleVisibility(modal) {
    if(modal.style.display == 'none' || modal.style.display == '') {
        modal.style.display = 'block';
    } else {
        modal.style.display = 'none';
    }
}