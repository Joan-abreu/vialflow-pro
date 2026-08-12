import { Card, CardContent } from "@/components/ui/card";
import SEO from "@/components/SEO";
import { getSEOConfig } from "@/config/seoConfig";

const About = () => {
    const seo = getSEOConfig("about");
    return (
        <div className="container py-12">
            <SEO title={seo.title} description={seo.description} />
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight">About Liv Well Research Labs</h1>
                    <p className="text-xl text-muted-foreground">
                        Direct laboratory manufacturer of ultra-pure reconstitution solutions and bacteriostatic water, and supplier of research peptides.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold">Our Mission</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            As a direct US manufacturer, Liv Well Research Labs formulates, sterile-filters, and packages high-purity reconstitution solutions and laboratory water in-house. We also supply premium research peptides to scientific researchers and institutions worldwide.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            By manufacturing our reconstitution solutions directly in-house, we guarantee batch-to-batch consistency, rigorous quality controls, and factory-direct pricing for research facilities.
                        </p>
                    </div>
                    <div className="bg-muted rounded-xl aspect-video flex items-center justify-center overflow-hidden border shadow-md relative group">
                        <img 
                            src="/lab-facility.png" 
                            alt="Liv Well Research Labs Cleanroom & Manufacturing Facility" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <Card>
                        <CardContent className="pt-6 text-center space-y-2">
                            <h3 className="font-semibold text-lg">In-House BAC Water Manufacturing</h3>
                            <p className="text-sm text-muted-foreground">
                                Reconstitution solutions formulated and sterile-filtered directly in cleanroom environments.
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 text-center space-y-2">
                            <h3 className="font-semibold text-lg">Lab & Research Focused</h3>
                            <p className="text-sm text-muted-foreground">
                                Solutions and peptides optimized for laboratory, educational, and scientific applications.
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 text-center space-y-2">
                            <h3 className="font-semibold text-lg">Direct Wholesale Pricing</h3>
                            <p className="text-sm text-muted-foreground">
                                Factory-direct pricing, custom vial labeling, and priority shipping for high-volume orders.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default About;
