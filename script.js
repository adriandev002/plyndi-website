// Mobile Menu Toggle
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

// Travel Planner Generator
const plannerForm = document.getElementById('plannerForm');
const plannerResult = document.getElementById('plannerResult');

if (plannerForm) {
    plannerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const destination = document.getElementById('destination').value;
        const days = parseInt(document.getElementById('days').value);

        const activities = [
            "Explore main landmarks and iconic sights",
            "Try local street food and visit traditional markets",
            "Visit cultural spots, museums, and historical sites",
            "Enjoy nature, parks, or scenic viewpoints",
            "Experience evening night markets and local shopping"
        ];

        let resultHTML = `
            <div class="card" style="text-align: left; margin-top: 20px; border-left: 5px solid var(--primary-color);">
                <h3 style="color: var(--primary-color); margin-bottom: 15px;">
                    <i class="fas fa-map-marked-alt"></i> ${days}-Day Trip Outline for ${destination}
                </h3>
                <ul style="padding-left: 20px; line-height: 1.8;">
        `;

        for (let i = 1; i <= days; i++) {
            const act = activities[(i - 1) % activities.length];
            resultHTML += `<li style="margin-bottom: 8px;"><strong>Day ${i}:</strong> ${act} in <em>${destination}</em>.</li>`;
        }

        resultHTML += `</ul></div>`;

        plannerResult.innerHTML = resultHTML;
    });
}

// Feedback Form
const feedbackForm = document.getElementById('feedbackForm');
if (feedbackForm) {
    feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for your feedback! We will get back to you soon.');
        feedbackForm.reset();
    });
}
