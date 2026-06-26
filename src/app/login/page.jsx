import { auth } from "@/auth";
import { LoginPage } from "@/components";
import { redirect } from "next/navigation";

export default async function SignInPage() {
    const session = await auth();
    // console.log(session);

    if (session?.user?.role === "admin") {
        return redirect('/admin');
    } else if (session?.user?.role === "user") {
        return redirect('/');
    } else {
        return <LoginPage />;
    }
}