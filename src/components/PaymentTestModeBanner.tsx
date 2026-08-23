import { getStripeEnvironment } from "@/lib/stripe";

export function PaymentTestModeBanner() {
  if (getStripeEnvironment() !== "sandbox") return null;

  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
      Payments are currently in test mode. No real charge will be made.
    </div>
  );
}
