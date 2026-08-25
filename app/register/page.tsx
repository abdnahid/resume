import RegisterForm from "./_components/RegisterForm";

export const metadata = { title: "Create an account — BSTI e-Services" };

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <RegisterForm />
    </div>
  );
}
