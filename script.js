// 1. Mobile Menu Toggle (ဖုန်းနဲ့ကြည့်ရင် Menu ပွင့်အောင်လုပ်ခြင်း)
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

// 2. Travel Planner Logic (ခရီးစဉ်အကြမ်းဖျင်း ထုတ်ပေးသည့်စနစ်)
const plannerForm = document.getElementById('plannerForm');
const plannerResult = document.getElementById('plannerResult');

if (plannerForm) {
    plannerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const destination = document.getElementById('destination').value;
        const days = document.getElementById('days').value;

        let resultHTML = `
            <div class="card" style="text-align: left; margin-top: 20px;">
                <h3 style="color: #20C1C4; margin-bottom: 10px;">
                    ${days}-Day Trip Outline for ${destination}
                </h3>
                <ul style="padding-left: 20px;">
        `;

        for (let i = 1; i <= days; i++) {
            resultHTML += `<li style="margin-bottom: 8px;"><strong>Day ${i}:</strong> Explore landmarks & enjoy local highlights in ${destination}.</li>`;
        }

        resultHTML += `</ul></div>`;

        plannerResult.innerHTML = resultHTML;
    });
}

// 3. Feedback Form Logic (Feedback ပို့လိုက်ကြောင်း အကြောင်းကြားခြင်း)
const feedbackForm = document.getElementById('feedbackForm');
if (feedbackForm) {
    feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for your feedback! We will get back to you soon.');
        feedbackForm.reset();
    });
}