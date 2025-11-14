import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      throw new Error("No image provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing shipping label with AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting shipping label information. Analyze the shipping label image and extract all available data. Return ONLY a valid JSON object with these fields (use null for missing data):
{
  "box_number": number or null,
  "destination": "two-letter state code" or null,
  "ups_tracking_number": "1Z..." or null,
  "fba_id": "FBA..." or null,
  "weight_lb": number or null,
  "dimension_length_in1": number or null,
  "dimension_width_in": number or null,
  "dimension_height_in": number or null,
  "qty": number or null
}

Look for:
- Box numbers (BOX, Box #, etc.)
- UPS tracking (1Z format)
- FBA shipment IDs (FBA prefix)
- Weight in pounds (LBS, lb)
- Dimensions in inches (L x H x W)
- Destination state code in shipping address
- Quantity of items in the box (QTY, Quantity, Units, etc.),

IMPORTANT:
When dimensions appear in formats like "27x17x15", "27 x 17 x 15", "LxWxH", or any similar variant,
ALWAYS interpret and return them using this strict positional rule:

1st number → dimension_length_in  
2nd number → dimension_height_in  
3rd number → dimension_width_in  

Example: "27x17x15" MUST be interpreted as:
length = 27
height = 17
width = 15

Ignore any alternative ordering (like LxWxH labels). The POSITION in the sequence is what determines the field.
`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all shipping information from this label image.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;

    console.log("AI response:", extractedText);

    // Parse the JSON response
    let extractedData;
    try {
      // Try to find JSON in the response
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = JSON.parse(extractedText);
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      throw new Error("Failed to parse AI response");
    }

    console.log("Extracted data:", extractedData);

    return new Response(JSON.stringify({ data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-label-data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
