import { Separator } from "@/components/ui/separator";

const Terms = () => {
    return (
        <div className="container py-12 md:py-20 max-w-4xl">
            <div className="space-y-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-4">TERMS & CONDITIONS</h1>
                    <p className="text-muted-foreground italic">Last Updated: January 15, 2026</p>
                </div>

                <Separator />

                <div className="space-y-6 text-muted-foreground leading-relaxed">
                    <p className="text-foreground">
                        Welcome to our website (the “Site”). By accessing or using the Site and/or purchasing products through it, you (“Customer,” “you”) agree to be bound by these Terms & Conditions. If you do not agree, please do not use the Site or purchase products.
                    </p>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">1. Nature of Products</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>All products offered through the Site are chemical and reconstitution solutions intended for laboratory research use only (RUO).</li>
                            <li>They are not designed, approved, or intended for human consumption, medical, diagnostic, or therapeutic use.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">2. Acceptance of Terms</h2>
                        <p>
                            By using the Site and/or purchasing products, you acknowledge that you have read, understood, and accepted these Terms and our Privacy Policy. We reserve the right to modify these Terms at any time by posting the updated version on the Site.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">3. Use of Site and Content</h2>
                        <p>
                            You agree to use the Site only for lawful purposes and in compliance with all applicable laws. You may not reproduce, modify, or distribute any content from the Site without explicit permission.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">4. Orders and Acceptance</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Orders placed are offers to purchase. Acceptance occurs when we send an order confirmation or deliver the product.</li>
                            <li>We reserve the right to refuse or cancel any order for legal reasons, suspected fraud, or misuse of products.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">5. Accuracy of Information</h2>
                        <p>
                            You warrant that all information provided (name, address, payment details, etc.) is accurate, complete, and current.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">6. Payments and Pricing</h2>
                        <p>
                            Prices are displayed in USD (and/or adjusted local currency) and include/exclude taxes as indicated at checkout. Payment must be successfully processed before your order is accepted and fulfilled.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">7. Shipping and Delivery</h2>
                        <p>
                            Estimated shipping times are provided but may vary due to product availability, carrier, or circumstances beyond our control. You are responsible for checking any import or customs restrictions.
                        </p>
                    </section>

                    <section className="space-y-4 bg-muted/30 p-6 rounded-lg border">
                        <h2 className="text-2xl font-semibold text-foreground">8. Limitation of Liability</h2>
                        <p className="font-medium">
                            IN NO EVENT shall we be liable for any indirect, incidental, or consequential damages arising from the use or inability to use the products or Site.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">9. Governing Law</h2>
                        <p>
                            These Terms are governed by the laws of the United States and the State of Florida, without regard to conflict of law principles.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Terms;
