import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface SendEmailDialogProps {
    recipientEmail: string;
    recipientName?: string;
    relatedId?: string; // e.g. orderId
    trigger?: React.ReactNode;
}

export const SendEmailDialog = ({ recipientEmail, recipientName, relatedId, trigger }: SendEmailDialogProps) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const handleSend = async () => {
        if (!subject.trim() || !message.trim()) {
            toast.error("Please provide both a subject and a message.");
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("send-system-notification", {
                body: {
                    type: "manual",
                    recipient: recipientEmail,
                    data: {
                        subject: subject,
                        title: subject,
                        message: message
                    },
                    related_id: relatedId
                }
            });

            if (error) throw error;

            toast.success("Email sent successfully to " + recipientEmail);
            setOpen(false);
            setSubject("");
            setMessage("");
        } catch (error: any) {
            console.error("Error sending manual email:", error);
            toast.error("Failed to send email: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Mail className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        Send Email to Customer
                    </DialogTitle>
                    <DialogDescription>
                        Sending from: <span className="font-semibold text-foreground">sales@livwellresearchlabs.com</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recipient</Label>
                        <div className="text-sm font-medium p-2 bg-muted rounded-md border italic">
                            {recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail}
                        </div>
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="subject" className="text-xs uppercase tracking-wider text-muted-foreground">Subject</Label>
                        <Input 
                            id="subject" 
                            value={subject} 
                            onChange={(e) => setSubject(e.target.value)} 
                            placeholder="e.g. Update regarding your order"
                        />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="message" className="text-xs uppercase tracking-wider text-muted-foreground">Message</Label>
                        <Textarea 
                            id="message" 
                            value={message} 
                            onChange={(e) => setMessage(e.target.value)} 
                            placeholder="Write your message here..."
                            className="min-h-[250px] resize-none"
                        />
                        <p className="text-[10px] text-muted-foreground italic text-center mt-2">
                            The message will be wrapped in the professional Liv Well Research Labs email template.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSend} disabled={loading} className="gap-2">
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                        Send Email
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
