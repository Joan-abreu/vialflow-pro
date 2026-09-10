export interface PeptideComponent {
    name: string;
    amount_mg: number;
}

export interface COA {
    id: string;
    product_id: string | null;
    product_ids: string[];
    variant_ids: string[];
    coa_type: 'peptide' | 'water';
    batch_number: string;
    test_date: string;
    pdf_url: string;
    purity_pct: number | null;
    // Water / Reconstitution Solution fields
    ph_level: number | null;
    benzyl_alcohol_pct: number | null;
    sterility_status: string;
    // Peptide analytical testing fields (Janoshik HPLC/MS)
    target_dosage_mg: number | null;
    measured_dosage_mg: number | null;
    task_number: string | null;
    verification_key: string | null;
    verification_url: string | null;
    sequence_status: string | null;
    appearance: string | null;
    components: PeptideComponent[];
    // Metadata
    is_active: boolean;
    lab_name: string;
    is_featured: boolean;
    created_at?: string;
    updated_at?: string;
    products?: {
        id: string;
        name: string;
        slug?: string;
        image_url?: string;
    };
}

export type COARecord = COA;
