/* Show/hide sharing pop up */
window.addEventListener('load', function(event) {
    // Modal to display sharing options 
    const shareWindow = document.getElementsByClassName('share-background')[0];

    // Listen for sharing button click *
    const shareButton = document.getElementById('share');
    shareButton.onclick = function() {
        toggleVisibility(shareWindow);
    }

    // Check if user was sent from email w/ share permalink 
    if(window.location.hash == '#share') {
        console.log('got here');
        // Display sharing popup
        toggleVisibility(shareWindow);
    }

    // Click 'share' (or url) = show sharing hash
    // Click close = remove sharing hash
});

function toggleVisibility(modal) {
    if(modal.style.display = 'none') {
        modal.style.display = 'block';
    } else {
        modal.style.display = 'none';
    }
}