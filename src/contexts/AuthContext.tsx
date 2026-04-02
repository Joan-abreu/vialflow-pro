import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        const getInitialSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session);
                setUser(session?.user ?? null);
            } catch (error) {
                console.error("Error checking auth session:", error);
            } finally {
                setLoading(false);
            }
        };

        getInitialSession();
        
        // Safety timeout to prevent infinite loading if getSession or onAuthStateChange hangs
        const safetyTimeout = setTimeout(() => {
            if (loading) {
                setLoading(false);
            }
        }, 5000);

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log("AuthContext: onAuthStateChange event:", event);
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
                clearTimeout(safetyTimeout);
            }
        );

        return () => {
            subscription.unsubscribe();
            if (safetyTimeout) clearTimeout(safetyTimeout);
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
