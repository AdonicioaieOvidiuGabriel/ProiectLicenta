import { Link } from "react-router-dom";
import { Menu, X, Phone, Facebook, Linkedin, Instagram, Mail, MapPin } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLink, setActiveLink] = useState("home");

  return (
    <>
      {/* Main Navbar */}
      <nav className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo Section */}
            <Link to="/" onClick={() => setActiveLink("home")} className="flex items-center space-x-2">
              <div className="h-14 w-14 flex items-center justify-center">
                <img src="/assets/logo.svg" alt="LicentaConnect" className="h-full w-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-usv-blue font-bold text-sm hidden sm:inline">LicentaConnect</span>
                <span className="text-usv-gold text-xs font-semibold hidden sm:inline">FIESC USV</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                to="/"
                onClick={() => setActiveLink("home")}
                className={`font-semibold transition-colors pb-1 ${
                  activeLink === "home"
                    ? "text-usv-blue border-b-2 border-usv-gold"
                    : "text-gray-700 hover:text-usv-blue"
                }`}
              >
                Acasă
              </Link>
              <a
                href="#features"
                onClick={() => setActiveLink("features")}
                className={`font-semibold transition-colors pb-1 ${
                  activeLink === "features"
                    ? "text-usv-blue border-b-2 border-usv-gold"
                    : "text-gray-700 hover:text-usv-blue"
                }`}
              >
                Cum Funcționează
              </a>
              <a
                href="#about"
                onClick={() => setActiveLink("about")}
                className={`font-semibold transition-colors pb-1 ${
                  activeLink === "about"
                    ? "text-usv-blue border-b-2 border-usv-gold"
                    : "text-gray-700 hover:text-usv-blue"
                }`}
              >
                Despre
              </a>
              <a
                href="#contact"
                onClick={() => setActiveLink("contact")}
                className={`font-semibold transition-colors pb-1 ${
                  activeLink === "contact"
                    ? "text-usv-blue border-b-2 border-usv-gold"
                    : "text-gray-700 hover:text-usv-blue"
                }`}
              >
                Contact
              </a>
            </div>

            {/* CTA Button */}
            <div className="hidden md:flex items-center space-x-3">
              <Link to="/login" className="px-6 py-2 bg-usv-gold text-usv-dark font-bold rounded-sm hover:bg-opacity-90 transition">
                Autentificare
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-usv-blue hover:text-usv-gold transition"
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isOpen && (
            <div className="md:hidden pb-4 space-y-3 border-t border-gray-200">
              <Link to="/" className="block text-usv-blue hover:text-usv-gold font-medium py-2">
                Acasă
              </Link>
              <a href="#features" className="block text-usv-blue hover:text-usv-gold font-medium py-2">
                Cum Funcționează
              </a>
              <a href="#about" className="block text-usv-blue hover:text-usv-gold font-medium py-2">
                Despre
              </a>
              <a href="#contact" className="block text-usv-blue hover:text-usv-gold font-medium py-2">
                Contact
              </a>
              <Link
                to="/login"
                className="block px-6 py-2 bg-usv-gold text-usv-dark font-bold rounded-sm text-center"
              >
                Autentificare
              </Link>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-usv-dark text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* About */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">LicentaConnect</h3>
            <p className="text-sm leading-relaxed text-gray-400">
              Platformă de recomandare a temelor de licență cu ajutorul Inteligenței Artificiale. Conectează studenții cu temele și profesorii ideali.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-usv-gold font-bold text-sm mb-4 uppercase">Navigare</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-usv-gold transition-colors">Acasă</Link></li>
              <li><a href="#" className="hover:text-usv-gold transition-colors">Cum Funcționează</a></li>
              <li><a href="#" className="hover:text-usv-gold transition-colors">Despre Noi</a></li>
              <li><a href="#" className="hover:text-usv-gold transition-colors">Întrebări Frecvente</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-usv-gold font-bold text-sm mb-4 uppercase">Resurse</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://fiesc.usv.ro/" target="_blank" rel="noopener noreferrer" className="hover:text-usv-gold transition-colors">FIESC USV</a></li>
              <li><a href="https://usv.ro/" target="_blank" rel="noopener noreferrer" className="hover:text-usv-gold transition-colors">Site USV</a></li>
              <li><a href="#" className="hover:text-usv-gold transition-colors">Documentație</a></li>
              <li><a href="#" className="hover:text-usv-gold transition-colors">Blog</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-usv-gold font-bold text-sm mb-4 uppercase">Contact</h4>
            <div className="space-y-3 text-sm">
              <a href="tel:+40230522978" className="flex items-center space-x-2 hover:text-usv-gold transition-colors">
                <Phone size={16} /> <span>+40 230 522 978</span>
              </a>
              <a href="mailto:contact@licentaconnect.ro" className="flex items-center space-x-2 hover:text-usv-gold transition-colors">
                <Mail size={16} /> <span>contact@licentaconnect.ro</span>
              </a>
              <a href="#" className="flex items-center space-x-2 hover:text-usv-gold transition-colors">
                <MapPin size={16} /> <span>Suceava, România</span>
              </a>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="border-t border-gray-700 pt-8 mb-8">
          <div className="flex justify-center space-x-6">
            <a href="#" className="text-gray-400 hover:text-usv-gold transition-colors" title="Facebook">
              <Facebook size={20} />
            </a>
            <a href="#" className="text-gray-400 hover:text-usv-gold transition-colors" title="LinkedIn">
              <Linkedin size={20} />
            </a>
            <a href="#" className="text-gray-400 hover:text-usv-gold transition-colors" title="Instagram">
              <Instagram size={20} />
            </a>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="border-t border-gray-700 pt-8 text-center text-sm text-gray-500">
          <p>&copy; {currentYear} LicentaConnect. Toate drepturile rezervate.</p>
          <p className="mt-2 text-xs">Universitatea "Ștefan cel Mare" din Suceava - Facultatea de Inginerie Electrică și Știința Calculatoarelor</p>
          <div className="mt-4 space-x-4 text-xs">
            <a href="#" className="hover:text-usv-gold transition-colors">Politică de Confidențialitate</a>
            <a href="#" className="hover:text-usv-gold transition-colors">Termeni de Utilizare</a>
            <a href="#" className="hover:text-usv-gold transition-colors">Politica Cookie</a>
          </div>
        </div>
      </div>
    </footer>
  );
}


export default function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-white overflow-x-hidden">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
