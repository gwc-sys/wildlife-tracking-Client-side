import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { Navigation, Pagination, Autoplay } from 'swiper/modules'; // Import Autoplay module

// Import your images
import image1 from '../assets/pexels-muchowmedia-2955703.jpg';
import image2 from '../assets/pexels-pixabay-45853.jpg';
import image3 from '../assets/pexels-pixabay-47547.jpg';
import image4 from '../assets/pexels-valeriya-1961772.jpg';

export default function Home() {
  return (
    <div className="bg-white">
      {/* Slider Section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <Swiper
          modules={[Navigation, Pagination, Autoplay]} // Add Autoplay module
          navigation
          pagination={{ clickable: true }}
          loop={true}
          autoplay={{ delay: 5000, disableOnInteraction: false }} // Set autoplay delay to 5 seconds
          className="mySwiper"
        >
          {/* Slide 1 */}
          <SwiperSlide>
            <div className="relative w-full h-[500px]">
              <img
                src={image1}
                alt="Slide 1"
                className="w-full h-full object-cover rounded-lg"
              />
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-black bg-opacity-50 text-white">
                <h2 className="text-3xl font-bold">Explore the Wildlife</h2>
                <p className="mt-2 text-lg">Discover the beauty of nature and its creatures.</p>
              </div>
            </div>
          </SwiperSlide>

          {/* Slide 2 */}
          <SwiperSlide>
            <div className="relative w-full h-[500px]">
              <img
                src={image2}
                alt="Slide 2"
                className="w-full h-full object-cover rounded-lg"
              />
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-black bg-opacity-50 text-white">
                <h2 className="text-3xl font-bold">Protect Our Planet</h2>
                <p className="mt-2 text-lg">Join us in preserving the environment.</p>
              </div>
            </div>
          </SwiperSlide>

          {/* Slide 3 */}
          <SwiperSlide>
            <div className="relative w-full h-[500px]">
              <img
                src={image3}
                alt="Slide 3"
                className="w-full h-full object-cover rounded-lg"
              />
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-black bg-opacity-50 text-white">
                <h2 className="text-3xl font-bold">Experience the Wild</h2>
                <p className="mt-2 text-lg">Get closer to the wonders of wildlife.</p>
              </div>
            </div>
          </SwiperSlide>

          {/* Slide 4 */}
          <SwiperSlide>
            <div className="relative w-full h-[500px]">
              <img
                src={image4}
                alt="Slide 4"
                className="w-full h-full object-cover rounded-lg"
              />
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-black bg-opacity-50 text-white">
                <h2 className="text-3xl font-bold">Join the Movement</h2>
                <p className="mt-2 text-lg">Be a part of our mission to save wildlife.</p>
              </div>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>

      {/* Welcome Section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Welcome to Our Platform
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Discover amazing opportunities and connect with our community. We're here to make a difference together.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <a
                href="/get-involved"
                className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Get Involved
              </a>
              <a href="/about" className="text-sm font-semibold leading-6 text-gray-900">
                Learn more <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}