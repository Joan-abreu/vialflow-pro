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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log("Analyzing shipping label with Gemini...");

    // Clean base64 (remove prefix "data:image/...;base64,")
    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    // Gemini request
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `
You are an expert at extracting shipping label information. Extract the data and return ONLY valid JSON using this schema:

{
  "box_number": number | null,
  "destination": string | null,
  "ups_tracking_number": string | null,
  "fba_id": string | null,
  "weight_lb": number | null,
  "dimension_length_in": number | null,
  "dimension_width_in": number | null,
  "dimension_height_in": number | null,
  "qty": number | null
}

Rules:
- "destination" MUST be ONLY the U.S. two-letter state code (e.g., FL, CA, NY). Never include city names, ZIP codes, or full addresses.
- "ups_tracking_number" must have NO spaces.
- Dimensions must ALWAYS follow this strict mapping by POSITION ONLY:
  1st = length, 2nd = height, 3rd = width
  Ignore any L/W/H notation.
- If multiple dimension sets appear, choose the most prominent.
                  `,
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini ERROR:", errorText);
      throw new Error("Gemini API error: " + errorText);
    }

    const result = await response.json();

    const textOutput =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("Gemini raw output:", textOutput);

    // Extract JSON safely
    let extractedData;
    try {
      const match = textOutput.match(/\{[\s\S]*\}/);
      extractedData = match ? JSON.parse(match[0]) : JSON.parse(textOutput);
    } catch (err) {
      console.error("JSON parse error:", err);
      throw new Error("Failed to parse JSON from Gemini output");
    }

    console.log("Extracted data:", extractedData);

    return new Response(JSON.stringify({ data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-label-data:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
