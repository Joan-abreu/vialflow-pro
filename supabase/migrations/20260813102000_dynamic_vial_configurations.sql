-- Migration: Dynamically generate Vial Configurations for each peptide based on its actual variants

DO $$
DECLARE
    r RECORD;
    v_capacities text;
    v_vial_config text;
    v_vial_size text;
BEGIN
    FOR r IN 
        SELECT 
            p.id,
            p.name,
            ARRAY_AGG(DISTINCT vt.capacity_ml ORDER BY vt.capacity_ml) as cap_arr
        FROM products p
        JOIN product_categories pc ON p.category_id = pc.id
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        LEFT JOIN vial_types vt ON pv.vial_type_id = vt.id
        WHERE LOWER(pc.name) LIKE '%peptide%'
        GROUP BY p.id, p.name
    LOOP
        -- Build capacities text
        IF r.cap_arr IS NULL OR array_length(r.cap_arr, 1) IS NULL THEN
            v_vial_config := 'Supplied in sealed glass vials for laboratory research';
        ELSE
            -- Determine vial size text based on max capacity
            IF r.cap_arr[array_length(r.cap_arr, 1)] >= 500 THEN
                v_vial_size := '10mL glass vial';
            ELSIF r.cap_arr[array_length(r.cap_arr, 1)] >= 50 THEN
                v_vial_size := '5mL glass vial';
            ELSE
                v_vial_size := '3mL glass vial';
            END IF;

            IF array_length(r.cap_arr, 1) = 1 THEN
                v_vial_config := r.cap_arr[1] || 'mg supplied in ' || v_vial_size;
            ELSIF array_length(r.cap_arr, 1) = 2 THEN
                v_vial_config := r.cap_arr[1] || 'mg or ' || r.cap_arr[2] || 'mg supplied in ' || v_vial_size || 's';
            ELSE
                -- For 3 or more: e.g. 10mg, 30mg, or 60mg
                SELECT string_agg(c || 'mg', ', ') INTO v_capacities
                FROM unnest(r.cap_arr[1:array_length(r.cap_arr, 1)-1]) AS c;

                v_vial_config := v_capacities || ', or ' || r.cap_arr[array_length(r.cap_arr, 1)] || 'mg supplied in ' || v_vial_size || 's';
            END IF;
        END IF;

        -- Update rich_description for this specific product
        UPDATE products
        SET rich_description = '<p class="text-base font-semibold text-primary mb-3">' || r.name || ' — Research Peptide</p>' ||
        '<p><strong>' || r.name || '</strong> is a high-purity research peptide compound supplied by <strong>Liv Well Research Labs</strong> strictly for laboratory research and <em>in vitro</em> analytical applications. Each unit is supplied as a sterile lyophilized powder in a vacuum-sealed glass vial, manufactured in cGMP-compliant facilities and independently validated through rigorous 4x third-party testing protocols, multi-vial batch conformity screening, and mass spectrometry quantification.</p>' ||
        '<h3>Product Specifications</h3>' ||
        '<ul>' ||
        '  <li><strong>Compound:</strong> ' || r.name || '</li>' ||
        '  <li><strong>Physical Form:</strong> Lyophilized powder (Freeze-dried)</li>' ||
        '  <li><strong>Vial Configurations:</strong> ' || v_vial_config || '</li>' ||
        '  <li><strong>Purity Level:</strong> 99%+ verified via HPLC and Mass Spectrometry (See COAs)</li>' ||
        '  <li><strong>Testing Standard:</strong> 4x Independent Third-Party Analytical Verification Protocol</li>' ||
        '</ul>' ||
        '<h3>Analytical Verification & Quality Control</h3>' ||
        '<p>Every batch of <strong>' || r.name || '</strong> undergoes exhaustive analytical testing across independent testing laboratories to ensure ultimate compound integrity:</p>' ||
        '<ul>' ||
        '  <li>High-Performance Liquid Chromatography (HPLC) for purity determination</li>' ||
        '  <li>Mass Spectrometry (MS) for structural and molecular weight confirmation</li>' ||
        '  <li>Exact identity verification and quantitative concentration screening</li>' ||
        '  <li>4-Vial Batch Conformity Verification for intra-lot statistical reliability</li>' ||
        '</ul>' ||
        '<p>Batch-specific Certificates of Analysis (COAs) are provided with every order. Each vial features a direct QR code linking to its batch COA documenting full verification results for complete analytical traceability.</p>' ||
        '<h3>Research Context</h3>' ||
        '<p><strong>' || r.name || '</strong> is manufactured and supplied strictly for laboratory research applications, peptide chemistry studies, and <em>in vitro</em> cellular investigations. As a reference compound, ' || r.name || ' is supplied exclusively for analytical investigation by qualified scientific researchers operating in appropriate laboratory environments.</p>' ||
        '<h3>Reconstitution & Storage Guidelines</h3>' ||
        '<ul>' ||
        '  <li><strong>Lyophilized Storage (Unopened):</strong> Store sealed in a cool, dry location protected from direct light.</li>' ||
        '  <li><strong>Long-Term Storage:</strong> Store at -20°C for maximum long-term stability.</li>' ||
        '  <li><strong>Post-Reconstitution Storage:</strong> Once reconstituted for research purposes using laboratory-grade Bacteriostatic Water, store solution at 2–8°C (refrigerated) and protect from UV exposure.</li>' ||
        '  <li><strong>Optimal Stability Window:</strong> Utilize reconstituted material within 60 days to ensure compound integrity.</li>' ||
        '  <li><strong>Handling Precaution:</strong> Avoid repeated freeze-thaw cycles to prevent structural degradation of the peptide chain.</li>' ||
        '</ul>' ||
        '<h3>Quality Assurance Standard</h3>' ||
        '<p>Liv Well Research Labs maintains rigorous quality control standards across all research compounds. Our multi-layered QA protocol provides researchers with verified, high-purity reference materials:</p>' ||
        '<ul>' ||
        '  <li>✓ 4x Independent third-party testing per production lot</li>' ||
        '  <li>✓ 4-Vial batch conformity verification for statistical confidence</li>' ||
        '  <li>✓ Synthesized and packaged in cGMP-compliant facilities</li>' ||
        '  <li>✓ Full batch traceability via QR-code COA access</li>' ||
        '  <li>✓ Same-day shipping available for orders placed before 6:00 PM EST cutoff</li>' ||
        '</ul>' ||
        '<h3>Terms of Sale & Legal Compliance</h3>' ||
        '<p>By purchasing this product, the buyer explicitly confirms and attests that:</p>' ||
        '<ul>' ||
        '  <li>They are 21 years of age or older.</li>' ||
        '  <li>They are a qualified research professional, authorized institutional researcher, or accredited research entity.</li>' ||
        '  <li>They accept full responsibility for proper handling, storage, hazard control, and regulatory compliance.</li>' ||
        '  <li><strong>Strictly Not For Human Use:</strong> This material is supplied exclusively for laboratory <em>in vitro</em> research and is strictly prohibited for human consumption, therapeutic use, veterinary applications, or <em>in vivo</em> administration.</li>' ||
        '</ul>'
        WHERE id = r.id;
    END LOOP;
END $$;
