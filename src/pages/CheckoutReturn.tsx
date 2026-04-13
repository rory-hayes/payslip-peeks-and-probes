import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {sessionId ? (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Payment successful!</h1>
              <p className="text-muted-foreground">
                Your account has been upgraded. All premium features are now unlocked.
              </p>
              <Link to="/dashboard">
                <Button className="w-full mt-4">Go to Dashboard</Button>
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">No session found</h1>
              <p className="text-muted-foreground">
                It looks like something went wrong. Please try again or contact support.
              </p>
              <Link to="/pricing">
                <Button variant="outline" className="w-full mt-4">Back to Pricing</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
