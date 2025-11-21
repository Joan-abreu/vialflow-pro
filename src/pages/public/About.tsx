import { Card, CardContent } from "@/components/ui/card";

const About = () => {
    return (
        <div className="container py-12">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight">About Liv Well Research Labs</h1>
                    <p className="text-xl text-muted-foreground">
                        Advancing scientific research through premium quality peptides and supplies.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-semibold">Our Mission</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            At Liv Well Research Labs, we are dedicated to providing researchers and institutions with the highest purity peptides and laboratory water. We understand that the integrity of your research depends on the quality of your materials.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            Our commitment to excellence ensures that every product meets rigorous standards for purity and consistency, supporting the advancement of scientific discovery.
                        </p>
                    </div>
                    <div className="bg-muted rounded-lg aspect-video flex items-center justify-center">
                        <span className="text-muted-foreground">Lab Image Placeholder</span>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <Card>
                        <CardContent className="pt-6 text-center space-y-2">
                            <h3 className="font-semibold text-lg">Quality Assurance</h3>
                            <p className="text-sm text-muted-foreground">
                                Every batch is rigorously tested to ensure &gt;99% purity and consistency.
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 text-center space-y-2">
                            <h3 className="font-semibold text-lg">Research Focused</h3>
                            <p className="text-sm text-muted-foreground">
                                Products designed specifically for laboratory and research applications.
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 text-center space-y-2">
                            <h3 className="font-semibold text-lg">Fast Shipping</h3>
                            <p className="text-sm text-muted-foreground">
                                Reliable and secure shipping to ensure your research stays on schedule.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default About;
