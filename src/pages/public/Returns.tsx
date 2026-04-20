import { Separator } from "@/components/ui/separator";

const Returns = () => {
    return (
        <div className="container py-12 md:py-20 max-w-4xl">
            <div className="space-y-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-4 uppercase">Return & Refund Policy</h1>
                    <p className="text-muted-foreground italic">Last Updated: April 20, 2026</p>
                </div>

                <Separator />

                <div className="space-y-6 text-muted-foreground leading-relaxed">
                    <p className="text-foreground">
                        We want you to be satisfied with your purchase. This policy explains our procedures for returns and refunds to provide a transparent shopping experience.
                    </p>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">Returns</h2>
                        <p>
                            You may request a return within <span className="font-semibold text-foreground">14 days</span> of receiving your item. To be eligible, items must be unused and in original condition.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">Non-returnable items</h2>
                        <p>
                            Certain items may not be eligible for return, including:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Perishable goods</li>
                            <li>Personalized or custom items</li>
                            <li>Final sale items</li>
                            <li>Items that have been opened or used for research</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">Refunds</h2>
                        <p>
                            Once your return is received and inspected, we will notify you of the approval or rejection of your refund. If approved, your refund will be processed and a credit will automatically be applied to your original method of payment within <span className="font-semibold text-foreground">5–10 business days</span>.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">Shipping costs</h2>
                        <p>
                            Shipping fees are non-refundable unless the item was defective or incorrect. You will be responsible for paying for your own shipping costs for returning your item.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">How to request a return</h2>
                        <p>
                            To initiate a return, please contact us at:
                        </p>
                        <p className="font-bold text-foreground">
                            📧 <a href="mailto:sales@livwellresearchlabs.com" className="text-primary hover:underline">sales@livwellresearchlabs.com</a>
                        </p>
                        <p>
                            Please include your order number and the reason for the return in your email.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Returns;
