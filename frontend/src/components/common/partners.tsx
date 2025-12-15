// import AirtelLogo from "@/components/icons/airtel";
import verizonLogo from "@/assets/images/verizon.png"
import tMobile from "@/assets/images/tmobile.png"
import vodafone from "@/assets/images/vodafone.png"
import threeUk from "@/assets/images/three.png"
import emirates from "@/assets/images/emirates.png"
import singapore from "@/assets/images/singaporeairlines.png"
import klm from "@/assets/images/klm.png"
import airfrance from "@/assets/images/airfrance.png"
import Image from "next/image";
import {motion} from "framer-motion"




export default function Partners(){
    return <div className="py-14 bg-white">
    <div className="max-w-screen-xl mx-auto px-4 md:px-8">
        <div className="max-w-xl mx-auto text-center">
            <h3 className="text-gray-800 text-3xl font-semibold sm:text-4xl">
                Our global partners
            </h3>
            <p className="text-gray-600 mt-3">
                Our global parterships enable us to reach a wider global customer base, delivering high quality digital products and experiences
            </p>
        </div>
        <div className="mt-12 flex justify-center">
            <ul className="inline-grid grid-cols-2 gap-x-10 gap-y-6 md:gap-x-16 md:grid-cols-3 lg:grid-cols-4">

                {/* LOGO 1 */}
              <motion.li
              initial={{ opacity: 0, translateX:  50, translateY: -50 }}
              animate={{ opacity: 1, translateX: 0, translateY: 0 }}
              transition={{ duration: 0.3, delay: 1 * 0.3 }}
              >
                <Image alt="Three Uk" src={threeUk} height={200} width={200} className="h-12 sm:h-24 w-auto" />
              </motion.li>

                {/* LOGO 2 */}
              <motion.li
                initial={{ opacity: 0, translateX:  -50, translateY: -50 }}
                animate={{ opacity: 1, translateX: 0, translateY: 0 }}
                transition={{ duration: 0.3, delay: 2 * 0.3 }}
              >
                <Image alt="Verizon Wireless" src={verizonLogo} height={200} width={200} className="h-12 sm:h-24 w-auto" />
              </motion.li>

                {/* LOGO 3 */}
              <motion.li
                initial={{ opacity: 0, translateX:  50, translateY: -50 }}
                animate={{ opacity: 1, translateX: 0, translateY: 0 }}
                transition={{ duration: 0.3, delay: 3 * 0.3 }}
              >
              <Image alt="T-Mobile USA" src={tMobile} height={200} width={200} className="h-12 sm:h-24 w-auto" />
              </motion.li>

                {/* LOGO 4 */}
              <motion.li
                initial={{ opacity: 0, translateX:  -50, translateY: -50 }}
                animate={{ opacity: 1, translateX: 0, translateY: 0 }}
                transition={{ duration: 0.3, delay: 4 * 0.3 }}
              >
              <Image alt="Vodafone" src={vodafone} height={200} width={200} className="h-12 sm:h-24 w-auto" />
              </motion.li>

                {/* LOGO 5 */}
              <motion.li
                initial={{ opacity: 0, translateX:  50, translateY: -50 }}
                animate={{ opacity: 1, translateX: 0, translateY: 0 }}
                transition={{ duration: 0.3, delay: 5 * 0.3 }}
              >
              <Image alt="Fly Emirates" src={emirates} height={200} width={200} className="h-12 sm:h-24 w-auto" />
              </motion.li>

                {/* LOGO 6 */}
              <motion.li
                initial={{ opacity: 0, translateX:  -50, translateY: -50 }}
                animate={{ opacity: 1, translateX: 0, translateY: 0 }}
                transition={{ duration: 0.3, delay: 6 * 0.3 }}
              >
              <Image alt="Singapore airlines" src={singapore} height={200} width={200} className="h-12 sm:h-24 w-auto" />
              </motion.li>

                {/* LOGO 7 */}
              <motion.li
                initial={{ opacity: 0, translateX:  50, translateY: -50 }}
                animate={{ opacity: 1, translateX: 0, translateY: 0 }}
                transition={{ duration: 0.3, delay: 7 * 0.3 }}
              >
              <Image alt="Air France" src={airfrance} height={200} width={200} className="h-12 sm:h-24 w-auto" />
              </motion.li>

                {/* LOGO 8 */}
              <motion.li
                initial={{ opacity: 0, translateX:  -50, translateY: -50 }}
                animate={{ opacity: 1, translateX: 0, translateY: 0 }}
                transition={{ duration: 0.3, delay: 8 * 0.3 }}
              >
              <Image alt="KLM Airlines" src={klm} height={200} width={200} className="h-12 sm:h-24 w-auto" />
              </motion.li>

            </ul>
        </div>
    </div>
</div>
}