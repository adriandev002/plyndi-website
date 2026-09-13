// 1. Mobile Menu Toggle
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

// 2. Dynamic Travel Planner Data & Logic
const itineraryData = {
    yangon: {
        "1": ["Day 1: Shwedagon Pagoda, Kandawgyi Lake & Night Market at Strand Road"],
        "2": ["Day 1: Shwedagon Pagoda & Downtown Colonial Buildings", "Day 2: Bogyoke Market & Yangon River Sunset Cruise"],
        "3": ["Day 1: Shwedagon Pagoda & Downtown Architecture", "Day 2: Circular Train Ride & Bogyoke Market", "Day 3: National Museum & Kandawgyi Park Walk"]
    },
    bagan: {
        "1": ["Day 1: Ananda Temple, Dhammayangyi & Sunset Boat Cruise"],
        "2": ["Day 1: Famous Temples Tour (Ananda, Thatbyinnyu) by E-Bike", "Day 2: Local Lacquerware Workshop & Remote Temple Exploration"],
        "3": ["Day 1: Sunrise Viewpoint & Ancient Temples", "Day 2: Mount Popa Day Trip", "Day 3: Villages & Irrawaddy River Sunset"]
    },
    bangkok: {
        "1": ["Day 1: The Grand Palace, Wat Arun & Asiatique Night Market"],
        "2": ["Day 1: Grand Palace & Chao Phraya River Cruise", "Day 2: Shopping at Siam Paragon & Chatuchak Weekend Market"],
        "3": ["Day 1: Historical Temples Tour", "Day 2: Modern Shopping Centers & Rooftop Bars", "Day 3: Day Trip to Ayutthaya Ancient Ruins"]
    }
};

const plannerForm = document.getElementById('plannerForm');
const plannerResult = document.getElementById('plannerResult');

if (plannerForm) {
    plannerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const destination = document.getElementById('destination').value;
        const days = document.getElementById('days').value;

        if (itineraryData[destination] && itineraryData[destination][days]) {
            const planItems = itineraryData[destination][days];
            let listHTML = planItems.map(item => `<li style="margin-bottom: 10px; line-height: 1.6;">${item}</li>`).join("");

            plannerResult.innerHTML = `
                <div class="card" style="text-align: left; margin-top: 20px;">
                    <h3 style="color: var(--primary-color); margin-bottom: 15px;">
                        ${days}-Day Suggested Itinerary for ${destination.toUpperCase()}
                    </h3>
                    <ul style="padding-left: 20px;">
                        ${listHTML}
                    </ul>
                </div>
            `;
        }
    });
}

// 3. Feedback Form Logic
const feedbackForm = document.getElementById('feedbackForm');
if (feedbackForm) {
    feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for your feedback! We will review it shortly.');
        feedbackForm.reset();
    });
}
