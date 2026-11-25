
/* =========================================================
   TRAVELORA - MAIN JAVASCRIPT
   USER + ADMIN DASHBOARD DATA INTEGRATION
========================================================= */


/* =========================================================
   STORAGE KEYS
========================================================= */

const TRAVELORA_NOTIFICATION_KEY = "traveloraNotifications";
const TRAVELORA_USERS_KEY = "traveloraUsers";
const TRAVELORA_BOOKINGS_KEY = "travelBookings";
const TRAVELORA_TRIPS_KEY = "traveloraTrips";
const TRAVELORA_PAYMENTS_KEY = "traveloraPayments";
const TRAVELORA_REVIEWS_KEY = "traveloraReviews";


/* =========================================================
   COMMON STORAGE FUNCTIONS
========================================================= */

function getTraveloraArray(key) {

    try {

        const data = JSON.parse(
            localStorage.getItem(key) || "[]"
        );

        return Array.isArray(data) ? data : [];

    } catch (error) {

        console.error("Storage read error:", key, error);

        return [];

    }

}


function saveTraveloraArray(key, data) {

    try {

        if (!Array.isArray(data)) {

            throw new Error("Data must be an array.");

        }

        localStorage.setItem(
            key,
            JSON.stringify(data)
        );

        /*
           Update other components on the same page.
        */

        window.dispatchEvent(
            new CustomEvent("traveloraDataUpdated", {
                detail: {
                    key: key
                }
            })
        );

        return true;

    } catch (error) {

        console.error("Storage save error:", key, error);

        return false;

    }

}


function generateTraveloraId(prefix) {

    return prefix +
        "-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 8).toUpperCase();

}


function parseTraveloraAmount(value) {

    if (value === null || value === undefined || value === "") {

        return 0;

    }

    if (typeof value === "number") {

        return Number.isFinite(value) ? value : 0;

    }

    const amount = Number(
        String(value).replace(/[^\d.-]/g, "")
    );

    return Number.isFinite(amount) ? amount : 0;

}


/* =========================================================
   ADMIN DASHBOARD DATA UPDATE EVENT
========================================================= */

function notifyTraveloraDataChanged(key) {

    window.dispatchEvent(
        new CustomEvent("traveloraDataUpdated", {
            detail: {
                key: key
            }
        })
    );

}


/* =========================================================
   USER MANAGEMENT
   Saves registered users for the admin dashboard.
========================================================= */

function saveTraveloraUser(userDetails) {

    if (!userDetails) {

        return false;

    }


    const users = getTraveloraArray(TRAVELORA_USERS_KEY);


    const email = String(userDetails.email || "")
        .trim()
        .toLowerCase();


    const phone = String(userDetails.phone || "")
        .trim();


    const contact = String(userDetails.contact || "")
        .trim();


    /*
       A user can be identified using email or phone.
       This also supports phone-based registrations.
    */

    if (!email && !phone && !contact) {

        console.warn(
            "User could not be saved because email or phone is missing."
        );

        return false;

    }


    const existingIndex = users.findIndex(function(user) {

        const existingEmail = String(user.email || "")
            .trim()
            .toLowerCase();

        const existingPhone = String(user.phone || "")
            .trim();

        const existingContact = String(user.contact || "")
            .trim();


        return (

            (email && existingEmail === email) ||

            (phone && existingPhone === phone) ||

            (contact && existingContact === contact)

        );

    });


    const existingUser =
        existingIndex >= 0
            ? users[existingIndex]
            : {};


    const userName =
        userDetails.name ||
        userDetails.userName ||
        existingUser.name ||
        existingUser.userName ||
        "Travelora User";


    const user = {

        ...existingUser,

        id:
            existingUser.id ||
            userDetails.id ||
            generateTraveloraId("USER"),

        userId:
            existingUser.userId ||
            userDetails.userId ||
            existingUser.id ||
            userDetails.id ||
            generateTraveloraId("USER"),

        name: userName,

        userName: userName,

        email:
            email ||
            existingUser.email ||
            "",

        phone:
            phone ||
            existingUser.phone ||
            "",

        contact:
            contact ||
            existingUser.contact ||
            email ||
            phone ||
            existingUser.email ||
            existingUser.phone ||
            "",

        gender:
            userDetails.gender ||
            existingUser.gender ||
            "",

        role:
            userDetails.role ||
            existingUser.role ||
            "user",

        status:
            userDetails.status ||
            existingUser.status ||
            "Active",

        registeredOn:
            existingUser.registeredOn ||
            userDetails.registeredOn ||
            userDetails.createdAt ||
            new Date().toISOString(),

        createdAt:
            existingUser.createdAt ||
            userDetails.createdAt ||
            userDetails.registeredOn ||
            new Date().toISOString(),

        date:
            userDetails.date ||
            existingUser.date ||
            new Date().toLocaleDateString(),

        totalBookings:
            Number(existingUser.totalBookings || 0),

        totalSpent:
            parseTraveloraAmount(existingUser.totalSpent)

    };


    /*
       Preserve the password when updating a user.
       Add a password only when one is supplied.
    */

    if (
        userDetails.password !== undefined &&
        userDetails.password !== null &&
        userDetails.password !== ""
    ) {

        user.password = userDetails.password;

    }


    /*
       Preserve other existing registration information.
    */

    if (userDetails.lastLogin) {

        user.lastLogin = userDetails.lastLogin;

    }


    if (existingIndex >= 0) {

        /*
           Update the existing user instead of creating
           duplicate records.
        */

        users[existingIndex] = {

            ...existingUser,

            ...user

        };

    } else {

        users.unshift(user);

    }


    return saveTraveloraArray(
        TRAVELORA_USERS_KEY,
        users
    );

}


/*
   Synchronize the currently logged-in user with the
   admin dashboard's registered users list.

   This runs after signup/login redirects to another page.
*/

function syncCurrentUserToAdminRecords() {

    if (localStorage.getItem("isLoggedIn") !== "true") {

        return;

    }


    const role =
        localStorage.getItem("userRole") || "user";


    if (role === "admin") {

        return;

    }


    const name =
        localStorage.getItem("userName") || "Travelora User";

    const email =
        localStorage.getItem("userEmail") || "";

    const phone =
        localStorage.getItem("userPhone") || "";

    const gender =
        localStorage.getItem("userGender") || "";


    if (!email && !phone) {

        return;

    }


    /*
       Ensure the role is saved consistently.
    */

    localStorage.setItem("userRole", "user");


    saveTraveloraUser({

        name: name,

        email: email,

        phone: phone,

        gender: gender,

        role: "user",

        status: "Active"

    });

}


/* =========================================================
   NOTIFICATION SYSTEM
   Notifications are created only after successful bookings.
========================================================= */

function getTraveloraNotifications() {

    return getTraveloraArray(
        TRAVELORA_NOTIFICATION_KEY
    );

}


function getBookingServiceType(bookingName) {

    const name = String(bookingName || "").toLowerCase();


    if (
        name.includes("flight") ||
        name.includes("indigo") ||
        name.includes("air india") ||
        name.includes("akasa air")
    ) {

        return "flight";

    }


    if (
        name.includes("hotel") ||
        name.includes("resort") ||
        name.includes("grand wander") ||
        name.includes("city comfort")
    ) {

        return "hotel";

    }


    if (
        name.includes("cab") ||
        name.includes("taxi") ||
        name.includes("car rental")
    ) {

        return "cab";

    }


    if (
        name.includes("bus") ||
        name.includes("travels")
    ) {

        return "bus";

    }


    if (
        name.includes("train") ||
        name.includes("express") ||
        name.includes("superfast")
    ) {

        return "train";

    }


    if (
        name.includes("package") ||
        name.includes("holiday")
    ) {

        return "package";

    }


    if (
        name.includes("activity") ||
        name.includes("adventure")
    ) {

        return "activity";

    }


    return "booking";

}


/*
   Call this function only after a booking succeeds.
*/

function createBookingNotification(
    bookingName,
    destination,
    bookingId
) {

    const notifications = getTraveloraNotifications();

    const uniqueBookingId =
        bookingId ||
        generateTraveloraId("BOOKING");


    const alreadyExists = notifications.some(function(notification) {

        return notification.bookingId === uniqueBookingId;

    });


    if (alreadyExists) {

        return;

    }


    const serviceType =
        getBookingServiceType(bookingName);


    const place =
        destination ||
        localStorage.getItem("selectedDestination") ||
        "your selected destination";


    const notification = {

        id: "notification-" + uniqueBookingId,

        bookingId: uniqueBookingId,

        title: "Booking Confirmed",

        message:
            "Your " +
            String(bookingName || "travel service") +
            " booking for " +
            place +
            " has been confirmed successfully.",

        type: serviceType,

        category: "booking",

        service: serviceType,

        bookingName:
            String(bookingName || "Travel Booking"),

        destination: place,

        date: new Date().toISOString(),

        time: Date.now(),

        read: false

    };


    notifications.unshift(notification);


    saveTraveloraArray(
        TRAVELORA_NOTIFICATION_KEY,
        notifications
    );

}


/* =========================================================
   HOME SEARCH
========================================================= */

function searchTravel() {

    const from =
        document.getElementById("from")?.value.trim();

    const to =
        document.getElementById("to")?.value.trim();

    const date =
        document.getElementById("date")?.value;


    if (!from || !to) {

        alert("Please enter From and To locations.");

        return;

    }


    localStorage.setItem("from", from);

    localStorage.setItem("to", to);

    localStorage.setItem("date", date || "");

    localStorage.setItem("bookingFrom", from);

    localStorage.setItem("bookingTo", to);

    localStorage.setItem("bookingService", "flight");


    window.location.href = "flights.html";

}


/* =========================================================
   FLIGHTS
========================================================= */

function searchFlights() {

    const from =
        document.getElementById("flightFrom")?.value.trim();

    const to =
        document.getElementById("flightTo")?.value.trim();


    if (!from || !to) {

        alert("Please enter departure and destination.");

        return;

    }


    localStorage.setItem("bookingFrom", from);

    localStorage.setItem("bookingTo", to);

    localStorage.setItem("bookingService", "flight");


    const results =
        document.getElementById("flightResults");


    if (!results) return;


    results.innerHTML = `

        <div class="result-box">

            <h2>Available Flights</h2>

            <div class="result">

                <h3>IndiGo</h3>

                <p>${from} → ${to}</p>

                <p>09:30 AM → 11:45 AM</p>

                <h3>₹4,999</h3>

                <button
                    onclick="bookService('IndiGo Flight', 4999)"
                >
                    Book Now
                </button>

            </div>


            <div class="result">

                <h3>Air India</h3>

                <p>${from} → ${to}</p>

                <p>02:00 PM → 04:20 PM</p>

                <h3>₹5,499</h3>

                <button
                    onclick="bookService('Air India Flight', 5499)"
                >
                    Book Now
                </button>

            </div>


            <div class="result">

                <h3>Akasa Air</h3>

                <p>${from} → ${to}</p>

                <p>06:30 PM → 08:40 PM</p>

                <h3>₹4,799</h3>

                <button
                    onclick="bookService('Akasa Air Flight', 4799)"
                >
                    Book Now
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   HOTELS
========================================================= */

function searchHotels() {

    const city =
        document.getElementById("hotelCity")?.value.trim();


    if (!city) {

        alert("Please enter a city.");

        return;

    }


    localStorage.setItem("bookingTo", city);

    localStorage.setItem("bookingService", "hotel");


    const results =
        document.getElementById("hotelResults");


    if (!results) return;


    results.innerHTML = `

        <div class="result-box">

            <h2>Hotels in ${city}</h2>


            <div class="result">

                <h3>Grand Wander Hotel</h3>

                <p>★★★★★</p>

                <p>
                    Free Wi-Fi • Breakfast • Swimming Pool
                </p>

                <h3>₹3,499 / night</h3>

                <button
                    onclick="bookService('Grand Wander Hotel', 3499)"
                >
                    Book Hotel
                </button>

            </div>


            <div class="result">

                <h3>City Comfort Hotel</h3>

                <p>★★★★☆</p>

                <p>
                    Wi-Fi • Restaurant • Parking
                </p>

                <h3>₹2,799 / night</h3>

                <button
                    onclick="bookService('City Comfort Hotel', 2799)"
                >
                    Book Hotel
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   BUSES
========================================================= */

function searchBuses() {

    const from =
        document.getElementById("busFrom")?.value.trim();

    const to =
        document.getElementById("busTo")?.value.trim();


    if (!from || !to) {

        alert("Please enter From and To.");

        return;

    }


    localStorage.setItem("bookingFrom", from);

    localStorage.setItem("bookingTo", to);

    localStorage.setItem("bookingService", "bus");


    const results =
        document.getElementById("busResults");


    if (!results) return;


    results.innerHTML = `

        <div class="result-box">

            <h2>Available Buses</h2>


            <div class="result">

                <h3>Orange Travels</h3>

                <p>${from} → ${to}</p>

                <p>
                    AC Sleeper • 10:00 PM
                </p>

                <h3>₹899</h3>

                <button
                    onclick="bookService('Orange Travels Bus', 899)"
                >
                    Book Bus
                </button>

            </div>


            <div class="result">

                <h3>VRL Travels</h3>

                <p>${from} → ${to}</p>

                <p>
                    AC Seater • 09:00 PM
                </p>

                <h3>₹799</h3>

                <button
                    onclick="bookService('VRL Travels Bus', 799)"
                >
                    Book Bus
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   TRAINS
========================================================= */

function searchTrains() {

    const from =
        document.getElementById("trainFrom")?.value.trim();

    const to =
        document.getElementById("trainTo")?.value.trim();


    if (!from || !to) {

        alert("Please enter From and To.");

        return;

    }


    localStorage.setItem("bookingFrom", from);

    localStorage.setItem("bookingTo", to);

    localStorage.setItem("bookingService", "train");


    const results =
        document.getElementById("trainResults");


    if (!results) return;


    results.innerHTML = `

        <div class="result-box">

            <h2>Available Trains</h2>


            <div class="result">

                <h3>Express 12001</h3>

                <p>${from} → ${to}</p>

                <p>
                    06:00 AM → 12:30 PM
                </p>

                <h3>₹1,299</h3>

                <button
                    onclick="bookService('Express 12001 Train', 1299)"
                >
                    Book Train
                </button>

            </div>


            <div class="result">

                <h3>Superfast 12845</h3>

                <p>${from} → ${to}</p>

                <p>
                    08:30 PM → 03:00 AM
                </p>

                <h3>₹1,499</h3>

                <button
                    onclick="bookService('Superfast 12845 Train', 1499)"
                >
                    Book Train
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   BOOKING NAVIGATION
========================================================= */

function bookPackage(name, price) {

    localStorage.setItem("bookingName", name);

    localStorage.setItem("bookingPrice", price);

    localStorage.setItem("bookingService", "package");


    window.location.href = "booking.html";

}


function bookService(name, price) {

    localStorage.setItem("bookingName", name);


    const serviceType =
        getBookingServiceType(name);


    localStorage.setItem(
        "bookingService",
        serviceType
    );


    /*
       Store the selected price.
       Do not reuse an old price if no price is supplied.
    */

    if (price !== undefined && price !== null) {

        localStorage.setItem(
            "bookingPrice",
            String(parseTraveloraAmount(price))
        );

    } else {

        localStorage.removeItem("bookingPrice");

    }


    window.location.href = "booking.html";

}


/* =========================================================
   BOOKING PAGE INITIALIZATION
========================================================= */

window.addEventListener("DOMContentLoaded", function() {

    const bookingName =
        localStorage.getItem("bookingName");

    const element =
        document.getElementById("bookingName");


    if (bookingName && element) {

        element.innerText = bookingName;

    }

});


/* =========================================================
   PAYMENT RECORD CREATION
========================================================= */

function createTraveloraPayment(booking) {

    const payments =
        getTraveloraArray(TRAVELORA_PAYMENTS_KEY);


    const payment = {

        id: generateTraveloraId("PAY"),

        bookingId: booking.bookingId,

        userName: booking.userName,

        email: booking.email,

        amount: booking.amount,

        paymentMethod: "Not selected",

        transactionId: "",

        paymentStatus: "Pending",

        status: "Pending",

        date: new Date().toISOString(),

        timestamp: Date.now()

    };


    payments.unshift(payment);


    const saved = saveTraveloraArray(
        TRAVELORA_PAYMENTS_KEY,
        payments
    );


    return saved ? payment : null;

}


/* =========================================================
   CONFIRM BOOKING
   Saves booking data for the admin dashboard.
========================================================= */

function confirmBooking() {

    const name =
        document.getElementById("customerName")?.value.trim();

    const email =
        document.getElementById("customerEmail")?.value.trim();

    const phone =
        document.getElementById("customerPhone")?.value.trim();


    if (!name || !email || !phone) {

        alert("Please fill all details.");

        return;

    }


    const booking =
        localStorage.getItem("bookingName") ||
        "Travel Booking";


    const destination =
        localStorage.getItem("bookingTo") ||
        localStorage.getItem("selectedDestination") ||
        "Not specified";


    const amount = parseTraveloraAmount(
        localStorage.getItem("bookingPrice")
    );


    const bookingId =
        generateTraveloraId("TRV");


    const service =
        localStorage.getItem("bookingService") ||
        getBookingServiceType(booking);


    const currentUserEmail =
        localStorage.getItem("userEmail") || email;


    const trip = {

        id: bookingId,

        bookingId: bookingId,

        name: booking,

        bookingName: booking,

        userName: name,

        customer: name,

        email: email,

        phone: phone,

        destination: destination,

        from:
            localStorage.getItem("bookingFrom") || "",

        service: service,

        amount: amount,

        totalAmount: amount,

        price: amount,

        status: "Confirmed",

        bookingStatus: "Confirmed",

        paymentStatus: "Pending",

        paymentMethod: "Not selected",

        transactionId: "",

        date: new Date().toLocaleDateString(),

        bookingDate: new Date().toISOString(),

        timestamp: Date.now(),

        userEmail: currentUserEmail

    };


    /*
       Save the booking to the admin dashboard key.
    */

    try {

        const bookings =
            getTraveloraArray(TRAVELORA_BOOKINGS_KEY);


        bookings.unshift(trip);


        const bookingSaved = saveTraveloraArray(
            TRAVELORA_BOOKINGS_KEY,
            bookings
        );


        if (!bookingSaved) {

            throw new Error("Could not save booking.");

        }


        /*
           Also save the booking in the user's trips.
        */

        const savedTrips =
            getTraveloraArray(TRAVELORA_TRIPS_KEY);


        savedTrips.unshift(trip);


        const tripsSaved = saveTraveloraArray(
            TRAVELORA_TRIPS_KEY,
            savedTrips
        );


        if (!tripsSaved) {

            throw new Error("Could not save user trip.");

        }


        localStorage.setItem(
            "myTrip",
            JSON.stringify(trip)
        );


        /*
           Create a pending payment record.
           It will change to Paid only after payment success.
        */

        createTraveloraPayment(trip);


        /*
           Save the customer as a user if not already present.
        */

        saveTraveloraUser({

            name: name,

            email: email,

            phone: phone,

            role: "user",

            status: "Active"

        });


        /*
           Create booking notification.
        */

        createBookingNotification(
            booking,
            destination,
            bookingId
        );


        /*
           Store the latest booking ID for the payment page.
        */

        localStorage.setItem(
            "latestBookingId",
            bookingId
        );


    } catch (error) {

        console.error(
            "Booking could not be saved:",
            error
        );


        alert(
            "We could not save your booking. Please try again."
        );

        return;

    }


    alert(
        "Booking successful!\n\n" +
        "Booking ID: " +
        bookingId +
        "\nThank you " +
        name +
        "!"
    );


    window.location.href = "trips.html";

}


/* =========================================================
   UPDATE PAYMENT AFTER SUCCESSFUL PAYMENT
========================================================= */

/*
   IMPORTANT:

   Call this function only after your payment page
   confirms that payment was successful.

   Example:
   completeBookingPayment(
       localStorage.getItem("latestBookingId"),
       "UPI",
       "TXN123456"
   );
*/

function completeBookingPayment(
    bookingId,
    paymentMethod,
    transactionId
) {

    if (!bookingId) {

        alert("Booking ID is missing.");

        return false;

    }


    const bookings =
        getTraveloraArray(TRAVELORA_BOOKINGS_KEY);


    const bookingIndex = bookings.findIndex(function(item) {

        return String(item.bookingId || item.id) ===
            String(bookingId);

    });


    if (bookingIndex === -1) {

        alert("Booking not found.");

        return false;

    }


    bookings[bookingIndex].paymentStatus = "Paid";

    bookings[bookingIndex].paymentMethod =
        paymentMethod || "Not specified";

    bookings[bookingIndex].transactionId =
        transactionId || generateTraveloraId("TXN");

    bookings[bookingIndex].paymentDate =
        new Date().toISOString();


    saveTraveloraArray(
        TRAVELORA_BOOKINGS_KEY,
        bookings
    );


    /*
       Update the matching payment record.
    */

    const payments =
        getTraveloraArray(TRAVELORA_PAYMENTS_KEY);


    const paymentIndex = payments.findIndex(function(payment) {

        return String(payment.bookingId) ===
            String(bookingId);

    });


    if (paymentIndex >= 0) {

        payments[paymentIndex].paymentStatus = "Paid";

        payments[paymentIndex].status = "Paid";

        payments[paymentIndex].paymentMethod =
            paymentMethod || "Not specified";

        payments[paymentIndex].transactionId =
            bookings[bookingIndex].transactionId;

        payments[paymentIndex].paidAt =
            new Date().toISOString();


    } else {

        payments.unshift({

            id: generateTraveloraId("PAY"),

            bookingId: bookingId,

            userName:
                bookings[bookingIndex].userName,

            email:
                bookings[bookingIndex].email,

            amount:
                bookings[bookingIndex].amount,

            paymentMethod:
                paymentMethod || "Not specified",

            transactionId:
                bookings[bookingIndex].transactionId,

            paymentStatus: "Paid",

            status: "Paid",

            date: new Date().toISOString(),

            timestamp: Date.now()

        });

    }


    saveTraveloraArray(
        TRAVELORA_PAYMENTS_KEY,
        payments
    );


    /*
       Update the user's trip record too.
    */

    const trips =
        getTraveloraArray(TRAVELORA_TRIPS_KEY);


    trips.forEach(function(trip) {

        if (
            String(trip.bookingId || trip.id) ===
            String(bookingId)
        ) {

            trip.paymentStatus = "Paid";

            trip.paymentMethod =
                paymentMethod || "Not specified";

            trip.transactionId =
                bookings[bookingIndex].transactionId;

        }

    });


    saveTraveloraArray(
        TRAVELORA_TRIPS_KEY,
        trips
    );


    /*
       Update myTrip if it is the same booking.
    */

    try {

        const myTrip = JSON.parse(
            localStorage.getItem("myTrip") || "null"
        );


        if (
            myTrip &&
            String(myTrip.bookingId || myTrip.id) ===
            String(bookingId)
        ) {

            myTrip.paymentStatus = "Paid";

            myTrip.paymentMethod =
                paymentMethod || "Not specified";

            myTrip.transactionId =
                bookings[bookingIndex].transactionId;


            localStorage.setItem(
                "myTrip",
                JSON.stringify(myTrip)
            );

        }

    } catch (error) {

        console.error("Could not update myTrip:", error);

    }


    /*
       Update the user's booking totals.
    */

    const userEmail =
        bookings[bookingIndex].email ||
        bookings[bookingIndex].userEmail ||
        "";


    if (userEmail) {

        const users =
            getTraveloraArray(TRAVELORA_USERS_KEY);


        const userIndex = users.findIndex(function(user) {

            return String(user.email || "")
                .trim()
                .toLowerCase() ===
                String(userEmail).trim().toLowerCase();

        });


        if (userIndex >= 0) {

            const userBookings =
                bookings.filter(function(item) {

                    return String(item.email || "")
                        .trim()
                        .toLowerCase() ===
                        String(userEmail).trim().toLowerCase();

                });


            const paidBookings =
                userBookings.filter(function(item) {

                    return String(item.paymentStatus || "")
                        .toLowerCase() === "paid";

                });


            users[userIndex].totalBookings =
                userBookings.length;


            users[userIndex].totalSpent =
                paidBookings.reduce(function(total, item) {

                    return total + parseTraveloraAmount(
                        item.amount ||
                        item.totalAmount ||
                        item.price
                    );

                }, 0);


            saveTraveloraArray(
                TRAVELORA_USERS_KEY,
                users
            );

        }

    }


    alert("Payment updated successfully!");

    return true;

}


/* =========================================================
   LOGIN
========================================================= */

function loginUser() {

    const name =
        document.getElementById("loginName")?.value.trim();

    const email =
        document.getElementById("loginEmail")?.value.trim();

    const password =
        document.getElementById("loginPassword")?.value;


    if (!name || !email || !password) {

        alert("Please fill all login details.");

        return;

    }


    /*
       This is a front-end demo login.
       Real password verification requires a backend.

       The main login.html should handle actual
       password verification and role-based login.
    */

    localStorage.setItem("userName", name);

    localStorage.setItem("userEmail", email);

    localStorage.setItem("isLoggedIn", "true");

    localStorage.setItem("userRole", "user");


    saveTraveloraUser({

        name: name,

        email: email,

        role: "user"

    });


    alert("Login successful! Welcome " + name);


    window.location.href = "index.html";

}


/* =========================================================
   GOOGLE LOGIN DEMO
========================================================= */

function googleLogin() {

    alert(
        "Google login demonstration.\n" +
        "Connect Firebase/Google OAuth for real authentication."
    );

}


/* =========================================================
   LOGOUT
========================================================= */

function logoutUser() {

    localStorage.removeItem("isLoggedIn");

    localStorage.removeItem("userName");

    localStorage.removeItem("userEmail");

    localStorage.removeItem("userPhone");

    localStorage.removeItem("userGender");

    localStorage.removeItem("userRole");

    localStorage.removeItem("userId");


    alert("You have been logged out.");


    window.location.href = "login.html";

}


/* =========================================================
   LOGIN STATE
========================================================= */

function isUserLoggedIn() {

    return localStorage.getItem("isLoggedIn") === "true";

}


/* =========================================================
   HOME PAGE LOGIN STATE AND WISHLIST PROTECTION
========================================================= */

document.addEventListener("DOMContentLoaded", function() {

    const loggedIn = isUserLoggedIn();


    const guestNavigation =
        document.getElementById("homeGuestNavigation");


    const userNavigation =
        document.getElementById("homeUserNavigation");


    const wishlistLink =
        document.getElementById("homeWishlistLink");


    if (guestNavigation) {

        guestNavigation.style.display =
            loggedIn ? "none" : "flex";

    }


    if (userNavigation) {

        userNavigation.style.display =
            loggedIn ? "flex" : "none";

    }


    if (wishlistLink) {

        wishlistLink.addEventListener("click", function(event) {

            event.preventDefault();


            if (isUserLoggedIn()) {

                window.location.href = "wishlist.html";

            } else {

                alert(
                    "Please login or sign up to view your wishlist."
                );

                window.location.href = "login.html";

            }

        });

    }

});


/* =========================================================
   UPDATE HOME NAVIGATION
========================================================= */

function updateNavigation() {

    const loggedIn = isUserLoggedIn();


    const loggedInNavigation =
        document.getElementById("loggedInNavigation");


    const loggedOutNavigation =
        document.getElementById("loggedOutNavigation");


    if (loggedInNavigation) {

        loggedInNavigation.style.display =
            loggedIn ? "flex" : "none";

    }


    if (loggedOutNavigation) {

        loggedOutNavigation.style.display =
            loggedIn ? "none" : "flex";

    }

}


/* =========================================================
   WISHLIST
========================================================= */

function addWishlist(item) {

    let wishlist = [];


    try {

        wishlist = JSON.parse(
            localStorage.getItem("wishlist") || "[]"
        );


        if (!Array.isArray(wishlist)) {

            wishlist = [];

        }

    } catch (error) {

        wishlist = [];

    }


    if (!wishlist.includes(item)) {

        wishlist.push(item);


        localStorage.setItem(
            "wishlist",
            JSON.stringify(wishlist)
        );


        alert(item + " added to Wishlist!");

    } else {

        alert(item + " is already in Wishlist.");

    }

}


window.addEventListener("DOMContentLoaded", function() {

    const wishlistElement =
        document.getElementById("wishlistItems");


    if (!wishlistElement) {

        return;

    }


    let wishlist = [];


    try {

        wishlist = JSON.parse(
            localStorage.getItem("wishlist") || "[]"
        );


        if (!Array.isArray(wishlist)) {

            wishlist = [];

        }

    } catch (error) {

        wishlist = [];

    }


    if (wishlist.length === 0) {

        wishlistElement.innerHTML =
            "<p>Your wishlist is empty.</p>";

        return;

    }


    wishlistElement.innerHTML = "";


    wishlist.forEach(function(item) {

        const result =
            document.createElement("div");

        result.className = "result";


        const heading =
            document.createElement("h2");

        heading.textContent = item;


        const button =
            document.createElement("button");

        button.textContent = "Book Now";


        button.addEventListener("click", function() {

            bookService(item);

        });


        result.appendChild(heading);

        result.appendChild(button);

        wishlistElement.appendChild(result);

    });

});


/* =========================================================
   DESTINATION
========================================================= */

function chooseDestination(place) {

    localStorage.setItem(
        "selectedDestination",
        place
    );


    alert(
        place +
        " selected!\nLet's plan your trip."
    );


    window.location.href = "planner.html";

}


/* =========================================================
   OFFERS
========================================================= */

function applyOffer(code) {

    localStorage.setItem("coupon", code);


    alert(
        "Coupon " +
        code +
        " applied successfully!"
    );


    window.location.href = "packages.html";

}


/* =========================================================
   ACTIVITIES
========================================================= */

function bookActivity(activity) {

    localStorage.setItem(
        "bookingName",
        activity
    );

    localStorage.setItem(
        "bookingService",
        "activity"
    );


    localStorage.removeItem("bookingPrice");


    window.location.href = "booking.html";

}


/* =========================================================
   TRIP PLANNER
========================================================= */

function generateTrip() {

    const destination =
        document.getElementById("plannerDestination")?.value.trim();


    const budget =
        document.getElementById("plannerBudget")?.value;


    const style =
        document.getElementById("plannerStyle")?.value;


    if (!destination) {

        alert("Please enter a destination.");

        return;

    }


    const plan =
        document.getElementById("tripPlan");


    if (!plan) return;


    plan.innerHTML = `

        <div class="plan-result">

            <h2>
                Your Trip Plan ✨
            </h2>

            <h3>
                ${destination}
            </h3>

            <p>
                <b>Budget:</b> ${budget || "Not specified"}
            </p>

            <p>
                <b>Travel Style:</b> ${style || "Not specified"}
            </p>

            <hr>

            <p>
                Day 1: Arrival and local sightseeing
            </p>

            <p>
                Day 2: Explore famous attractions
            </p>

            <p>
                Day 3: Adventure and activities
            </p>

            <p>
                Day 4: Shopping and local food
            </p>

            <p>
                Day 5: Relaxation and departure
            </p>

            <button
                onclick="bookService('${destination.replace(/'/g, "\\'")} Trip')"
            >
                Book This Trip
            </button>

        </div>

    `;

}


/* =========================================================
   CONTACT
========================================================= */

function sendMessage() {

    const name =
        document.getElementById("contactName")?.value.trim();


    const email =
        document.getElementById("contactEmail")?.value.trim();


    const message =
        document.getElementById("contactMessage")?.value.trim();


    if (!name || !email || !message) {

        alert("Please fill all fields.");

        return;

    }


    alert(
        "Message sent successfully!\n" +
        "Our support team will contact you."
    );


    document.getElementById("contactName").value = "";

    document.getElementById("contactEmail").value = "";

    document.getElementById("contactMessage").value = "";

}


/* =========================================================
   PROFILE INFORMATION
========================================================= */

function loadProfileInformation() {

    const name =
        localStorage.getItem("userName");


    const email =
        localStorage.getItem("userEmail");


    const phone =
        localStorage.getItem("userPhone");


    const gender =
        localStorage.getItem("userGender");


    document.querySelectorAll(".profile-user-name").forEach(
        function(element) {

            element.innerText =
                name || "Travelora Traveller";

        }
    );


    document.querySelectorAll(".profile-user-email").forEach(
        function(element) {

            element.innerText =
                email || "Not available";

        }
    );


    document.querySelectorAll(".profile-user-phone").forEach(
        function(element) {

            element.innerText =
                phone || "Not available";

        }
    );


    document.querySelectorAll(".profile-user-gender").forEach(
        function(element) {

            element.innerText =
                gender || "Not specified";

        }
    );

}


/* =========================================================
   LEGACY BOOKING DATA MIGRATION
   Copies older user trips into the admin bookings list.
========================================================= */

function migrateOldTraveloraBookings() {

    const bookings =
        getTraveloraArray(TRAVELORA_BOOKINGS_KEY);


    const trips =
        getTraveloraArray(TRAVELORA_TRIPS_KEY);


    let changed = false;


    trips.forEach(function(trip) {

        const tripId =
            trip.bookingId || trip.id;


        if (!tripId) {

            return;

        }


        const alreadyExists = bookings.some(function(booking) {

            return String(booking.bookingId || booking.id) ===
                String(tripId);

        });


        if (!alreadyExists) {

            const migratedBooking = {

                ...trip,

                id: tripId,

                bookingId: tripId,

                userName:
                    trip.userName ||
                    trip.customer ||
                    trip.name ||
                    "Travelora User",

                amount: parseTraveloraAmount(
                    trip.amount ||
                    trip.totalAmount ||
                    trip.price
                ),

                totalAmount: parseTraveloraAmount(
                    trip.amount ||
                    trip.totalAmount ||
                    trip.price
                ),

                status:
                    trip.status ||
                    "Confirmed",

                paymentStatus:
                    trip.paymentStatus ||
                    "Pending"

            };


            bookings.unshift(migratedBooking);

            changed = true;

        }

    });


    if (changed) {

        saveTraveloraArray(
            TRAVELORA_BOOKINGS_KEY,
            bookings
        );

    }

}


/* =========================================================
   ADMIN DATA REFRESH HELPER
========================================================= */

function refreshTraveloraAdminData() {

    /*
       These keys are used by the admin dashboard.
       The dashboard should read these same keys.
    */

    const users =
        getTraveloraArray(TRAVELORA_USERS_KEY);


    const bookings =
        getTraveloraArray(TRAVELORA_BOOKINGS_KEY);


    const payments =
        getTraveloraArray(TRAVELORA_PAYMENTS_KEY);


    const reviews =
        getTraveloraArray(TRAVELORA_REVIEWS_KEY);


    console.log("Travelora Admin Data:", {

        users: users.length,

        bookings: bookings.length,

        payments: payments.length,

        reviews: reviews.length

    });


    notifyTraveloraDataChanged(TRAVELORA_USERS_KEY);

    notifyTraveloraDataChanged(TRAVELORA_BOOKINGS_KEY);

    notifyTraveloraDataChanged(TRAVELORA_PAYMENTS_KEY);

    notifyTraveloraDataChanged(TRAVELORA_REVIEWS_KEY);

}


/* =========================================================
   STORAGE EVENT
   Refresh other open tabs when data changes.
========================================================= */

window.addEventListener("storage", function(event) {

    if (

        event.key === TRAVELORA_USERS_KEY ||

        event.key === TRAVELORA_BOOKINGS_KEY ||

        event.key === TRAVELORA_PAYMENTS_KEY ||

        event.key === TRAVELORA_REVIEWS_KEY

    ) {

        console.log(
            "Travelora data changed in another tab:",
            event.key
        );

        refreshTraveloraAdminData();

    }

});


/* =========================================================
   PAGE INITIALIZATION
========================================================= */

window.addEventListener("DOMContentLoaded", function() {

    /*
       Save the current logged-in user in the admin users list.
    */

    syncCurrentUserToAdminRecords();


    /*
       Migrate bookings saved by the older version.
    */

    migrateOldTraveloraBookings();


    /*
       Update navigation and profile details.
    */

    updateNavigation();

    loadProfileInformation();


    /*
       Log current admin data counts for testing.
    */

    refreshTraveloraAdminData();

});


/* =========================================================
   TRAVELORA - ADMIN DASHBOARD LIVE METRICS
   ADD AFTER THE EXISTING PAGE INITIALIZATION
========================================================= */

function updateTraveloraAdminDashboardMetrics() {

    if (
        localStorage.getItem("isLoggedIn") !== "true" ||
        localStorage.getItem("userRole") !== "admin"
    ) {
        return;
    }

    const users = getTraveloraArray(TRAVELORA_USERS_KEY);
    const bookings = getTraveloraArray(TRAVELORA_BOOKINGS_KEY);
    const reviews = getTraveloraArray(TRAVELORA_REVIEWS_KEY);

    const normalUsers = users.filter(user =>
        String(user.role || "user").toLowerCase() !== "admin"
    );

    const paidBookings = bookings.filter(booking =>
        String(booking.paymentStatus || "").toLowerCase() === "paid"
    );

    const pendingBookings = bookings.filter(booking =>
        String(booking.paymentStatus || "pending").toLowerCase() === "pending"
    );

    const confirmedBookings = bookings.filter(booking =>
        String(booking.status || "").toLowerCase() === "confirmed"
    );

    const revenue = paidBookings.reduce((total, booking) => {
        return total + parseTraveloraAmount(
            booking.amount ||
            booking.totalAmount ||
            booking.price
        );
    }, 0);

    const ratings = reviews
        .map(review => Number(review.rating))
        .filter(rating => rating >= 1 && rating <= 5);

    const averageRating = ratings.length
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : 0;

    const update = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    update("totalUsers", normalUsers.length);
    update("totalBookings", bookings.length);
    update("totalRevenue", "₹" + revenue.toLocaleString("en-IN"));
    update("totalReviews", reviews.length);
    update("pendingPayments", pendingBookings.length);
    update("paidPayments", paidBookings.length);
    update("confirmedBookings", confirmedBookings.length);
    update("averageRating", averageRating.toFixed(1) + " / 5");
}


/* Refresh metrics whenever data changes on this page */

window.addEventListener("traveloraDataUpdated", function() {
    updateTraveloraAdminDashboardMetrics();
});


/* Refresh metrics when another tab updates storage */

window.addEventListener("storage", function(event) {

    const keys = [
        TRAVELORA_USERS_KEY,
        TRAVELORA_BOOKINGS_KEY,
        TRAVELORA_PAYMENTS_KEY,
        TRAVELORA_REVIEWS_KEY,
        TRAVELORA_TRIPS_KEY
    ];

    if (keys.includes(event.key) || event.key === null) {
        updateTraveloraAdminDashboardMetrics();
    }

});


/* Initialize dashboard metrics */

window.addEventListener("DOMContentLoaded", function() {
    updateTraveloraAdminDashboardMetrics();
});
