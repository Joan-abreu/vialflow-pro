import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Contact = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        subject: "",
        message: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { data, error } = await supabase.functions.invoke('send-system-notification', {
                body: {
                    type: 'contact_form',
                    data: {
                        ...formData
                    },
                    recipient: [] // Handle multiple recipients on the function side
                }
            });

            if (error) throw error;

            toast.success("Message sent! We'll get back to you soon.");
            setFormData({
                firstName: "",
                lastName: "",
                email: "",
                subject: "",
                message: ""
            });
        } catch (error: any) {
            console.error("Error sending message:", error);
            toast.error(error.message || "Failed to send message. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container py-12">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold tracking-tight mb-4">Contact Us</h1>
                    <p className="text-xl text-muted-foreground">
                        Have questions about our products? We're here to help.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Get in Touch</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-start space-x-4">
                                    <Mail className="w-6 h-6 text-primary mt-1" />
                                    <div>
                                        <h3 className="font-medium">Email</h3>
                                        <p className="text-muted-foreground">sales@livwellresearchlabs.com</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-4">
                                    <Phone className="w-6 h-6 text-primary mt-1" />
                                    <div>
                                        <h3 className="font-medium">Phone</h3>
                                        <p className="text-muted-foreground">754-326-8679</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-4">
                                    <MapPin className="w-6 h-6 text-primary mt-1" />
                                    <div>
                                        <h3 className="font-medium">Location</h3>
                                        <p className="text-muted-foreground">
                                            3839 N Andrews Ave<br />
                                            Oakland Park, FL 33309
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Send us a Message</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First Name</Label>
                                        <Input 
                                            id="firstName" 
                                            value={formData.firstName}
                                            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last Name</Label>
                                        <Input 
                                            id="lastName" 
                                            value={formData.lastName}
                                            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input 
                                        id="email" 
                                        type="email" 
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input 
                                        id="subject" 
                                        value={formData.subject}
                                        onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="message">Message</Label>
                                    <Textarea 
                                        id="message" 
                                        className="min-h-[150px]" 
                                        value={formData.message}
                                        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                        required 
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? "Sending..." : "Send Message"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Contact;
