document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;        const onlinePath = "online.txt";

const userData = {
    username: username,
    password: password
};
    fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
    })
    .then((response) => {
        if (response.status === 200) {
            // Registration successful
            alert("Login successful");
          localStorage.setItem('token', 'true');
          localStorage.setItem('name', username);
          localStorage.setItem('currentroom', 'Main_Chat');
          window.location.href = "./loading.html";

       } else {
            // Handle registration error
            alert("Login failed");
        }
    })
    .catch((error) => {
        // Handle fetch error
        alert("Fetch error:", error);
    });
});

