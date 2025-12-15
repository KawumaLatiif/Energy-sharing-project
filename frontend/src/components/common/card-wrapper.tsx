"use client"
const CardWrapper = ({title, children}: {title: string, children: React.ReactNode}) => {
    return (
        <div>

        <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
               
               

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                
            <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">

            <h1 className="text-2xl text-center py-5">{title}</h1>


                {children}

                </div>
                </div>

                </div>



        </div>
    );
}


export default CardWrapper;