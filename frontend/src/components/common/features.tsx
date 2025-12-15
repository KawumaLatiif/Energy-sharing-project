import { motion, AnimatePresence, stagger } from "framer-motion"

export default function Features() {

    const features = [
        {
            icon:
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>,
            title: "Tamper-Proof Certificates",
            desc: "All certificates are secured using blockchain technology, ensuring they cannot be altered, forged, or duplicated. Every credential is permanently stored and verifiable."
        },
        {
            icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          ,
            title: " Instant Verification",
            desc: "Say goodbye to lengthy validation processes. Certificates issued by Chain Certs can be verified instantly via a unique QR code or certificate ID, anywhere in the world."
        },
        {
            icon:
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
                </svg>,
            title: "Enhanced Reputation",
            desc: "Institutions and organizations using Chain Certs demonstrate their commitment to security, innovation, and authenticity, strengthening their reputation."
        },
    ]


    const boxVariant = {
        hidden: {
            x: "-100vw", //move out of the site
        },
        visible: {
            x: 0, // bring it back to nrmal
            transition: {
                delay: 0.5,
                when: "beforeChildren", //use this instead of delay
                staggerChildren: 0.5, //apply stagger on the parent tag
            },
        },
    };

    const listVariant = {
        hidden: {
            x: -10, //move out of the site
            opacity: 0,
        },
        visible: {
            x: 0, // bring it back to nrmal
            opacity: 1,
        },
    };

    return (
        <motion.section
        
        className="relative py-28 dark:bg-gradient-to-bl dark:from-gray-900 from-50% dark:to-teal-800">
            <div className="relative z-10 max-w-screen-xl mx-auto px-4 dark:text-gray-300 text-gray-900 justify-between gap-24 lg:flex md:px-8">
                <div className="max-w-xl">
                    <h3 className="dark:text-white text-gray-900 text-3xl font-semibold sm:text-4xl">
                        Why Chain Certs?
                    </h3>
                    <p className="mt-3">
                    Easily integrate Chain Certs into your existing systems with APIs, making the transition smooth for institutions and businesses.
                    </p>
                </div>
                <div className="mt-12 lg:mt-0">
                    <motion.ul
                    className="grid gap-8 sm:grid-cols-2">
                        {
                            features.map((item, idx) => (
                                <motion.li 
                                initial={{ opacity: 0, translateX: 50, translateY: -50 }}
                                animate={{ opacity: 1, translateX: 0, translateY: 0 }}
                                transition={{ duration: 0.3, delay: idx * 0.3 }}
                                key={idx}
                                className="flex gap-x-4">
                                    <div className="flex-none w-12 h-12 bg-gray-700 text-red-400 rounded-lg flex items-center justify-center">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h4 className="text-lg dark:text-gray-100 text-gray-900 font-semibold">
                                            {item.title}
                                        </h4>
                                        <p className="mt-3">
                                            {item.desc}
                                        </p>
                                    </div>
                                </motion.li>
                            ))
                        }
                    </motion.ul>
                </div>
            </div>
            <div className="absolute inset-0 max-w-md mx-auto h-72 blur-[118px]" style={{ background: "linear-gradient(152.92deg, rgba(192, 132, 252, 0.2) 4.54%, rgba(232, 121, 249, 0.26) 34.2%, rgba(192, 132, 252, 0.1) 77.55%)" }}></div>
        </motion.section>
    )
}