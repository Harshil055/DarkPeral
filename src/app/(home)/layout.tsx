import { Navbar } from "@/modules/home/ui/components/navbar";

interface Props {
  children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
  return (
    <main className="relative flex flex-col min-h-screen bg-black text-white overflow-hidden">
      <Navbar />
      <div className="fixed inset-0 -z-10 bg-black" />
      
      <div className="flex-1 flex flex-col px-4 pb-4">
        <div className="[&>h1]:text-white [&>h2]:text-white [&>h3]:text-white [&>h4]:text-white [&>h5]:text-white [&>h6]:text-white">
          {children}
        </div>
      </div>
    </main>
  );
};

export default Layout;
