import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import SEO from "@/components/SEO";

const SafetyDataSheets = () => {
    const sdsDocuments = [
        {
            name: "Reconstitution Solution 2-Pack - 10ml",
            filename: "sds-reconstitution-solution-10ml.pdf",
            size: "10ml",
            description: "Safety Data Sheet for Reconstitution Solution (10ml variant)."
        },
        {
            name: "Reconstitution Solution 2-Pack - 30ml",
            filename: "sds-reconstitution-solution-30ml.pdf",
            size: "30ml",
            description: "Safety Data Sheet for Reconstitution Solution (30ml variant)."
        }
    ];

    return (
        <div className="container py-12 md:py-20 max-w-4xl min-h-[60vh]">
            <SEO 
                title="Safety Data Sheets (SDS)" 
                description="Download Safety Data Sheets (SDS) for our laboratory research products." 
            />
            
            <div className="space-y-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-4">Safety Data Sheets (SDS)</h1>
                    <p className="text-muted-foreground text-lg">
                        Access and download the official Safety Data Sheets for our products. 
                        These documents provide essential safety, handling, and technical information.
                    </p>
                </div>

                <Separator />

                <div className="grid gap-6">
                    {sdsDocuments.map((doc, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-card border rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-4 mb-4 sm:mb-0">
                                <div className="p-3 bg-primary/10 rounded-lg text-primary mt-1">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-foreground mb-1">
                                        {doc.name}
                                    </h3>
                                    <p className="text-muted-foreground text-sm">
                                        {doc.description}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex-shrink-0">
                                <a 
                                    href={`/sds/${doc.filename}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    download
                                >
                                    <Button className="w-full sm:w-auto flex items-center gap-2">
                                        <Download className="h-4 w-4" />
                                        Download PDF
                                    </Button>
                                </a>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-muted/30 p-6 rounded-lg border mt-8">
                    <h3 className="font-semibold text-foreground mb-2">Need a document not listed here?</h3>
                    <p className="text-sm text-muted-foreground">
                        If you require a Safety Data Sheet for a product that is not currently listed on this page, please contact our support team.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SafetyDataSheets;
