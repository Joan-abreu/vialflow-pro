const url = "https://gtmpqjbbcobjxwfeyqzz.supabase.co/functions/v1/calculate-shipping";
const anonKey = "sb_publishable_34oYhC35s3nbQXs3UQt4eA_Ijk1yGJf";

async function test() {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${anonKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                weight: 10,
                address: {
                    name: "Joan",
                    line1: "5192 Northeast 6th Avenue",
                    city: "Oakland Park",
                    state: "FL",
                    postal_code: "33334",
                    country: "US"
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
