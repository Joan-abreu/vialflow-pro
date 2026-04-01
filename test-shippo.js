const url = "https://gtmpqjbbcobjxwfeyqzz.supabase.co/functions/v1/shipping";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0bXBxamJiY29ianh3ZmV5cXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NDAxNTgsImV4cCI6MjA3OTMxNjE1OH0.H6kFgf8qS6fSU5oFvlbn83FXhWPwQFZfDmOi_dPkkBk";

async function test() {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${anonKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                carrier: "SHIPPO",
                action: "create_shipment",
                data: {
                    orderId: "test-order-id",
                    serviceCode: "invalid-rate-id",
                    description: "Order #",
                    shipper: {
                        name: "Test",
                        address: {
                            line1: "123 Main St",
                            city: "Miami",
                            state: "FL",
                            zip: "33101",
                            country: "US"
                        }
                    },
                    recipient: {
                        name: "Customer",
                        address: {
                            line1: "456 Oak St",
                            city: "Orlando",
                            state: "FL",
                            zip: "32801",
                            country: "US"
                        }
                    },
                    packages: [{ weight: 1, length: 1, width: 1, height: 1 }]
                }
            })
        });

        const text = await response.text();
        console.log("Status:", response.status);
        console.log("Response:", text);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

test();
