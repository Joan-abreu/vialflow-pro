import { Separator } from "@/components/ui/separator";

const Privacy = () => {
    return (
        <div className="container py-12 md:py-20 max-w-4xl">
            <div className="space-y-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-4 uppercase">Privacy Policy</h1>
                    <p className="text-muted-foreground italic">Last Updated: January 15, 2026</p>
                </div>

                <Separator />

                <div className="space-y-6 text-muted-foreground leading-relaxed">
                    <p className="text-foreground">
                        Your privacy is important to us. This policy explains how we collect, use, share, and protect information when you visit the Site.
                    </p>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">1. Information We Collect</h2>
                        <p>We collect two types of information:</p>
                        
                        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                            <div>
                                <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                                    <span className="text-primary">📌</span> Information you provide directly, such as:
                                </h3>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>Full name</li>
                                    <li>Shipping and billing addresses</li>
                                    <li>Email address</li>
                                    <li>Phone number</li>
                                    <li>Payment information (processed by secure third parties)</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                                    <span className="text-primary">📌</span> Information collected automatically, such as:
                                </h3>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>IP address</li>
                                    <li>Browser type and device</li>
                                    <li>Pages visited and browsing behavior</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">2. How We Use Your Information</h2>
                        <p>We use the information we collect to:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Process orders and payments</li>
                            <li>Communicate with you regarding your purchase</li>
                            <li>Improve the Site and your user experience</li>
                            <li>Send updates and marketing communications (if you opt-in)</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">3. Sharing Information with Third Parties</h2>
                        <p>We may share information with:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Secure payment processors</li>
                            <li>Shipping providers</li>
                            <li>Analytics tools</li>
                        </ul>
                        <p className="font-medium text-foreground">
                            We do not sell or rent personal information to unaffiliated third parties without your consent.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">4. Data Security</h2>
                        <p>
                            We implement reasonable administrative, technical, and physical measures to protect your personal information.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">5. Cookies and Similar Technologies</h2>
                        <p>
                            We use cookies to understand Site usage, improve your experience, and provide personalized features. You can configure your browser to block cookies, although some Site functionality may be affected.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">6. Your Rights</h2>
                        <p>
                            Depending on your country of residence, you may have rights to access, correct, delete, or restrict the use of your personal information. To exercise these rights, contact us at <a href="mailto:sales@livwellresearchlabs.com" className="text-primary hover:underline">sales@livwellresearchlabs.com</a>.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-foreground">7. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy at any time. The most recent version will always be available on the Site with the date of last update.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Privacy;
